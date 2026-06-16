import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import OptimizedImage from "@food/components/OptimizedImage";

export default function HomeMobileCategories({ categories = [] }) {
  if (!categories.length) return null;

  return (
    <section className="food-mobile-categories">
      <div className="food-mobile-categories__header">
        <div className="min-w-0">
          <p className="food-mobile-categories__eyebrow">Cravings</p>
          <h2 className="food-mobile-categories__title">What&apos;s on your mind?</h2>
        </div>
        <Link to="/food/user/categories" className="food-mobile-categories__link">
          See all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="food-mobile-categories__scroll">
        {categories.map((category, index) => (
          <Link
            key={category.id || index}
            to={`/food/user/category/${category.slug}`}
            className="food-mobile-category-card group"
          >
            <div className="food-mobile-category-card__ring">
              <div className="food-mobile-category-card__image-wrap">
                <OptimizedImage
                  src={category.image}
                  alt={category.name}
                  className="food-mobile-category-card__image"
                />
              </div>
            </div>
            <span className="food-mobile-category-card__label">{category.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
