import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import {
  CheckCircle,
  MapPin,
  CreditCard,
  ArrowLeft,
  MessageSquare,
  Leaf,
  Bike,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import AnimatedPage from "@food/components/user/AnimatedPage";
import ScrollReveal from "@food/components/user/ScrollReveal";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { Input } from "@food/components/ui/input";
import { Label } from "@food/components/ui/label";
import { Badge } from "@food/components/ui/badge";
import { Textarea } from "@food/components/ui/textarea";
import { useCart } from "@food/context/CartContext";
import { useProfile } from "@food/context/ProfileContext";
import { useOrders } from "@food/context/OrdersContext";
import RestaurantUnavailableModal from "@food/components/user/cart/RestaurantUnavailableModal";
import { useCartRestaurantValidation } from "@food/hooks/useCartRestaurantValidation";

export default function Checkout() {
  const navigate = useNavigate();
  const {
    cart,
    clearCart,
    restaurantMeta,
    setRestaurantMeta,
    removeItemsByRestaurantIds,
    flushCartSave,
  } = useCart();
  const {
    getDefaultAddress,
    getDefaultPaymentMethod,
    setDefaultAddress,
    addresses,
    paymentMethods,
  } = useProfile();
  const { createOrder } = useOrders();
  const getAddressId = (address) => address?.id || address?._id || "";
  const [selectedAddressId, setSelectedAddressId] = useState(
    getAddressId(getDefaultAddress()),
  );
  const [selectedPayment, setSelectedPayment] = useState(
    getDefaultPaymentMethod()?.id || "",
  );
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const {
    closedRestaurants,
    showAvailabilityModal,
    isValidating,
    validateRestaurants,
    handleRemoveClosedRestaurantItems,
    handleContinueReviewingCart,
  } = useCartRestaurantValidation({
    cart,
    restaurantMeta,
    setRestaurantMeta,
    removeItemsByRestaurantIds,
  });

  const hasValidatedOnLoadRef = useRef(false);

  useEffect(() => {
    if (cart.length === 0 || hasValidatedOnLoadRef.current) return;
    hasValidatedOnLoadRef.current = true;
    validateRestaurants({ force: false });
  }, [cart.length, validateRestaurants]);

  const hasClosedRestaurants = closedRestaurants.length > 0;

  const selectedAddress =
    addresses.find((addr) => getAddressId(addr) === selectedAddressId) ||
    getDefaultAddress();
  const defaultPayment =
    paymentMethods.find((pm) => pm.id === selectedPayment) ||
    getDefaultPaymentMethod();

  useEffect(() => {
    const defaultId = getAddressId(getDefaultAddress());
    const selectedStillExists = addresses.some(
      (addr) => getAddressId(addr) === selectedAddressId,
    );

    if (!selectedAddressId || !selectedStillExists) {
      setSelectedAddressId(defaultId || "");
    }
  }, [addresses, selectedAddressId, getDefaultAddress]);

  const deliveryOptions = [
    {
      id: "eco",
      name: "Eco Saver",
      badge: "Save ₹125",
      badgeColor:
        "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-100 dark:border-green-900/30",
      time: "45–55 mins",
      estimatedTime: 50,
      fee: 1.49, // approx. ₹124
      description: "Batch delivery. Lower carbon footprint.",
      icon: Leaf,
    },
    {
      id: "standard",
      name: "Standard Delivery",
      badge: "Popular",
      badgeColor:
        "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30",
      time: "25–35 mins",
      estimatedTime: 30,
      fee: 2.99, // approx. ₹248
      description: "Direct to door. Reliable & prompt partner.",
      icon: Bike,
    },
    {
      id: "express",
      name: "Express Delivery",
      badge: "Zap Delivery",
      badgeColor:
        "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30",
      time: "15–20 mins",
      estimatedTime: 18,
      fee: 4.99, // approx. ₹414
      description: "Direct dispatch. Priority mapping partner.",
      icon: Zap,
    },
  ];

  const [deliveryOption, setDeliveryOption] = useState("standard");
  const selectedDeliveryOption =
    deliveryOptions.find((opt) => opt.id === deliveryOption) ||
    deliveryOptions[1];

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity * 83,
    0,
  );
  const deliveryFee = selectedDeliveryOption.fee * 83;
  const tax = subtotal * 0.08;
  const total = subtotal + deliveryFee + tax;

  const [restaurantNote, setRestaurantNote] = useState("");

  const handlePlaceOrder = async () => {
    if (!selectedAddress || !selectedPayment) {
      alert("Please select a delivery address and payment method");
      return;
    }

    if (cart.length === 0) {
      alert("Your cart is empty");
      return;
    }

    const validation = await validateRestaurants({ force: true });
    if (validation?.hasClosed) {
      return;
    }

    await flushCartSave();

    setIsPlacingOrder(true);

    // Simulate API call
    setTimeout(() => {
      const orderId = createOrder({
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
        })),
        address: selectedAddress,
        paymentMethod: defaultPayment,
        subtotal,
        deliveryFee,
        tax,
        total,
        restaurant:
          cart[0]?.restaurant || cart[0]?.name || "Multiple Restaurants",
        note: restaurantNote,
        deliveryOption: selectedDeliveryOption.name,
        deliveryTime: selectedDeliveryOption.time,
        estimatedTime: selectedDeliveryOption.estimatedTime,
      });

      clearCart();
      setIsPlacingOrder(false);
      navigate(`/user/orders/${orderId}?confirmed=true`);
    }, 1500);
  };

  if (cart.length === 0) {
    return (
      <AnimatedPage className="min-h-screen bg-linear-to-b from-orange-50/30 via-white to-orange-50/20 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg md:text-xl">
                Checkout
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg mb-4">
                  Your cart is empty
                </p>
                <Link to="/user/cart">
                  <Button>Go to Cart</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="min-h-screen bg-linear-to-b from-orange-50/30 via-white to-orange-50/20 dark:from-[#0a0a0a] dark:via-[#1a1a1a] dark:to-[#0a0a0a] p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        <ScrollReveal>
          <div className="flex items-center gap-4 mb-6 md:mb-8">
            <Link to="/user/cart">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8 md:h-10 md:w-10"
              >
                <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
              </Button>
            </Link>
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold dark:text-white">
              Checkout
            </h1>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address */}
            <ScrollReveal delay={0.1}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-[#23361A]" />
                    Delivery Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {addresses.length > 0 ? (
                    <div className="space-y-3">
                      {addresses.map((address) => {
                        const addressId = getAddressId(address);
                        const isSelected = selectedAddressId === addressId;
                        const addressString = [
                          address.street,
                          address.additionalDetails,
                          `${address.city}, ${address.state} ${address.zipCode}`,
                        ]
                          .filter(Boolean)
                          .join(", ");

                        return (
                          <div
                            key={
                              addressId ||
                              `${address.label}-${address.street}-${address.city}`
                            }
                            className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                              isSelected
                                ? "border-[#23361A] bg-orange-50"
                                : "border-gray-200 hover:border-orange-300"
                            }`}
                            onClick={() => {
                              setSelectedAddressId(addressId);
                              if (addressId) setDefaultAddress(addressId);
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                {address.isDefault && (
                                  <Badge className="mb-2 bg-[#23361A] text-white">
                                    Default
                                  </Badge>
                                )}
                                <p className="text-sm font-medium">
                                  {addressString}
                                </p>
                              </div>
                              {isSelected && (
                                <CheckCircle className="h-5 w-5 text-[#23361A]" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        No addresses saved
                      </p>
                      <Button
                        onClick={() =>
                          navigate("/user/cart/select-address", {
                            state: { from: "/user/cart/checkout" },
                          })
                        }
                      >
                        Add Address
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollReveal>

            {/* Delivery Speed Options */}
            <ScrollReveal delay={0.15}>
              <Card className="dark:bg-[#141414] dark:border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg dark:text-white font-extrabold tracking-tight">
                    <Bike className="h-5 w-5 text-[#23361A] dark:text-orange-400" />
                    Delivery Speed & Options
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {deliveryOptions.map((option) => {
                      const isSelected = deliveryOption === option.id;
                      const IconComponent = option.icon;
                      const feeAmount = option.fee * 83;

                      return (
                        <div
                          key={option.id}
                          className={`relative border-2 rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between h-full ${
                            isSelected
                              ? "border-[#23361A] dark:border-orange-400 bg-orange-50/40 dark:bg-orange-950/20 shadow-sm"
                              : "border-gray-100 hover:border-orange-200 dark:border-gray-800 dark:hover:border-gray-700 bg-white dark:bg-[#141414]"
                          }`}
                          onClick={() => setDeliveryOption(option.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`p-2 rounded-xl transition-colors ${
                                  isSelected
                                    ? "bg-[#23361A] dark:bg-orange-400 text-white dark:text-black"
                                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                }`}
                              >
                                <IconComponent className="h-4.5 w-4.5" />
                              </div>
                              <span className="font-bold text-sm dark:text-white leading-tight">
                                {option.name}
                              </span>
                            </div>
                            <div
                              className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "border-[#23361A] dark:border-orange-400 bg-[#23361A] dark:bg-orange-400"
                                  : "border-gray-300 dark:border-gray-600"
                              }`}
                            >
                              {isSelected && (
                                <span className="h-1.5 w-1.5 rounded-full bg-white dark:bg-black" />
                              )}
                            </div>
                          </div>

                          <div className="mt-3.5 space-y-1">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-lg font-extrabold text-gray-900 dark:text-white">
                                {option.time}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-snug">
                              {option.description}
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Delivery Charge
                            </span>
                            <span className="text-sm font-extrabold text-[#23361A] dark:text-orange-400">
                              {feeAmount === 0
                                ? "FREE"
                                : `₹${feeAmount.toFixed(0)}`}
                            </span>
                          </div>

                          {option.badge && (
                            <div className="absolute -top-2.5 left-4">
                              <Badge
                                className={`text-[10px] font-bold px-2 py-0.5 border ${option.badgeColor}`}
                              >
                                {option.badge}
                              </Badge>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>

            {/* Payment Method */}
            <ScrollReveal delay={0.2}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-[#23361A]" />
                    Payment Method
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {paymentMethods.length > 0 ? (
                    <div className="space-y-3">
                      {paymentMethods.map((payment) => {
                        const isSelected = selectedPayment === payment.id;
                        const cardNumber = `**** **** **** ${payment.cardNumber}`;

                        return (
                          <div
                            key={payment.id}
                            className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                              isSelected
                                ? "border-[#23361A] bg-orange-50"
                                : "border-gray-200 hover:border-orange-300"
                            }`}
                            onClick={() => setSelectedPayment(payment.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {payment.isDefault && (
                                    <Badge className="bg-[#23361A] text-white">
                                      Default
                                    </Badge>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className="capitalize"
                                  >
                                    {payment.type}
                                  </Badge>
                                </div>
                                <p className="font-semibold">{cardNumber}</p>
                                <p className="text-sm text-muted-foreground">
                                  {payment.cardHolder} Expires{" "}
                                  {payment.expiryMonth}/
                                  {payment.expiryYear.slice(-2)}
                                </p>
                              </div>
                              {isSelected && (
                                <CheckCircle className="h-5 w-5 text-[#23361A]" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <Link
                        to="/user/profile/payments"
                        className="block w-full"
                      >
                        <Button variant="outline" className="w-full">
                          Manage Payment Methods
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        No payment methods saved
                      </p>
                      <Link to="/user/profile/payments/new">
                        <Button>Add Payment Method</Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollReveal>

            {/* Note for Restaurant */}
            <ScrollReveal delay={0.25}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-[#23361A]" />
                    Add note for restaurant
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="E.g. Please make it extra spicy, or no onions..."
                    value={restaurantNote}
                    onChange={(e) => setRestaurantNote(e.target.value)}
                    className="min-h-[100px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Your request will be shared with the restaurant.
                  </p>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <ScrollReveal delay={0.3}>
              <Card className="sticky top-4 md:top-6 dark:bg-[#1a1a1a] dark:border-gray-800">
                <CardHeader>
                  <CardTitle className="text-base md:text-lg lg:text-xl dark:text-white">
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  <div className="space-y-3 md:space-y-4 max-h-64 md:max-h-80 overflow-y-auto">
                    // Dummy Offers Section
                    <div className="my-4 p-4 border rounded">
                      <h4 className="font-bold mb-2">Available Offers:</h4>
                      <ul className="list-disc pl-5">
                        <li>Get 10% off on orders above ₹500</li>
                        <li>Free dessert on orders above ₹300</li>
                        <li>
                          Use code WELCOME20 to get 20% off on your first order
                        </li>
                      </ul>
                    </div>
                    // Coupon Code Section
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-bold mb-2">
                        Apply Coupon Code
                      </h3>
                      <Input
                        type="text"
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="mb-2"
                      />
                      <Button
                        onClick={() => {
                          if (couponCode.trim().toUpperCase() === "SAVE20") {
                            alert("Coupon applied successfully!");
                            // Implement logic to adjust pricing based on the coupon
                          } else {
                            alert("Invalid coupon code");
                          }
                        }}
                      >
                        Apply Coupon
                      </Button>
                    </div>
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 md:gap-4 pb-3 md:pb-4 border-b dark:border-gray-700"
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm md:text-base dark:text-gray-200">
                            {item.name}
                          </p>
                          {item.variantName ? (
                            <p className="text-xs md:text-sm text-muted-foreground">
                              {item.variantName}
                            </p>
                          ) : null}
                          <p className="text-xs md:text-sm text-muted-foreground">
                            ₹{(item.price * 83).toFixed(0)} × {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold text-sm md:text-base dark:text-gray-200">
                          ₹{(item.price * 83 * item.quantity).toFixed(0)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 md:space-y-3 pt-4 md:pt-6 border-t dark:border-gray-700">
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="dark:text-gray-200">
                        ₹{subtotal.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">
                        Delivery Fee
                      </span>
                      <span className="dark:text-gray-200">
                        ₹{deliveryFee.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="dark:text-gray-200">
                        ₹{tax.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-lg md:text-xl lg:text-2xl pt-2 md:pt-3 border-t dark:border-gray-700">
                      <span className="dark:text-white">Total</span>
                      <span className="text-[#23361A] dark:text-orange-400">
                        ₹{total.toFixed(0)}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-[#23361A] hover:bg-[#A2B447] text-white mt-4 md:mt-6 h-11 md:h-12 text-sm md:text-base border-none"
                    onClick={handlePlaceOrder}
                    disabled={
                      isPlacingOrder ||
                      isValidating ||
                      hasClosedRestaurants ||
                      !selectedAddress ||
                      !selectedPayment
                    }
                  >
                    {isPlacingOrder ? "Placing Order..." : "Place Order"}
                  </Button>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>
        </div>
      </div>

      <RestaurantUnavailableModal
        open={showAvailabilityModal}
        closedRestaurants={closedRestaurants}
        onRemoveClosedItems={handleRemoveClosedRestaurantItems}
        onContinueReviewing={handleContinueReviewingCart}
      />
    </AnimatedPage>
  );
}
