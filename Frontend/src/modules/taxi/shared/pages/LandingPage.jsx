import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, Clock, Gift, Map, Car, Phone, Mail, LogIn } from 'lucide-react';
import './LandingPage.css';
import { useSettings } from '../../../shared/context/SettingsContext';

// Using the existing project images
import heroImg from '@/assets/landing/hero.png';
import rideImg from '@/assets/landing/ride.png';
import parcelImg from '@/assets/landing/parcel.png';
import bikeImg from '@/assets/landing/bike.png';
import heroBgImg from '@/assets/landing/hero-bg.png';
import newHeroTaxiImg from '@/assets/ride-removebg-preview.png';
import checkUsOutImg from '@/assets/check_us_out.jpg';
import { Download } from 'lucide-react';

// Custom Brand SVG Icons
const YoutubeIcon = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" {...props}>
    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.388.507 9.388.507s7.517 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const LinkedinIcon = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" {...props}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const InstagramIcon = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const FacebookIcon = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" {...props}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

function LandingPage() {
  const navigate = useNavigate();
  const { settings, modules } = useSettings();
  const appName = settings.general?.app_name || 'easytaxi';
  const [activeTab, setActiveTab] = React.useState('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const serviceNames = React.useMemo(() => {
    const activeModules = Array.isArray(modules)
      ? modules
          .filter((module) => module?.active)
          .slice()
          .sort((a, b) => {
            const orderA = Number(a?.order_by);
            const orderB = Number(b?.order_by);
            const hasOrderA = Number.isFinite(orderA);
            const hasOrderB = Number.isFinite(orderB);

            if (hasOrderA && hasOrderB && orderA !== orderB) {
              return orderA - orderB;
            }

            if (hasOrderA !== hasOrderB) {
              return hasOrderA ? -1 : 1;
            }

            return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' });
          })
          .map((module) => String(module?.name || '').trim())
          .filter(Boolean)
      : [];

    if (activeModules.length > 0) {
      return activeModules;
    }

    return [
      'City Rides',
      'Airport transfers',
      'Outstation Trips',
      'Parcel Delivery',
      'Bike Taxis',
      '24/7 Customer Support',
    ];
  }, [modules]);
  const appLinks = [
    {
      label: 'User App',
      href: 'https://play.google.com/store/apps/details?id=com.rydon24.user',
    },
    {
      label: 'Driver App',
      href: 'https://play.google.com/store/apps/details?id=com.rydon24.driver',
    },
  ];

  // Custom logo rendering to match 'easytaxi' style (first part yellow, second part white)
  const renderLogo = () => {
    const nameStr = appName.toString();
    if (nameStr.toLowerCase() === 'easytaxi' || nameStr.length > 4) {
      const mid = Math.floor(nameStr.length / 2);
      return (
        <>
          {nameStr.substring(0, mid)}
          <span className="text-white">{nameStr.substring(mid)}</span>
        </>
      );
    }
    return nameStr;
  };

  const handleRedirect = (path, tabName) => (e) => {
    e?.preventDefault();
    if (tabName) setActiveTab(tabName);
    setIsMobileMenuOpen(false);
    if (path.startsWith('#')) {
      const element = document.querySelector(path);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(path);
    }
  };

  return (
    <div className="landing-page">
      {/* New Header & Hero Wrapper */}
      <div className="new-hero-wrapper">
        <div className="new-hero-background" style={{ backgroundImage: `url(${heroBgImg})` }}></div>

        {/* Top Info Bar */}
        <div className="new-top-bar">
          <div className="new-logo-container">
            <a href="/" className="new-logo">
              <span style={{ color: '#333' }}>Buddy Service</span>
            </a>
          </div>
          <div className="new-top-contacts">
            <div className="top-contact-item">
              <Phone size={16} />
              <span>91-93-911-911</span>
            </div>
            <div className="top-contact-item">
              <Mail size={16} />
              <span>customercare@buddyservice.com</span>
            </div>
          </div>
        </div>

        {/* Main Header / Nav */}
        <header className="new-main-header">
          <div className="new-nav-bg-slant"></div>
          <div className="new-nav-container">
            <a href="/" className="mobile-only-logo">
              <span>Buddy Service</span>
            </a>
            <nav className={`new-nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
              <a href="#home" className={`new-nav-link ${activeTab === 'home' ? 'active' : ''}`} onClick={handleRedirect('#home', 'home')}>Home</a>
              <Link to="/about" className={`new-nav-link ${activeTab === 'about' ? 'active' : ''}`} onClick={() => { setActiveTab('about'); setIsMobileMenuOpen(false); }}>Company</Link>
              <Link to="/services" className={`new-nav-link ${activeTab === 'services' ? 'active' : ''}`} onClick={() => { setActiveTab('services'); setIsMobileMenuOpen(false); }}>Our Taxi</Link>
              <Link to="/faq" className={`new-nav-link ${activeTab === 'faq' ? 'active' : ''}`} onClick={() => { setActiveTab('faq'); setIsMobileMenuOpen(false); }}>FAQs</Link>
              <Link to="/blog" className={`new-nav-link ${activeTab === 'blog' ? 'active' : ''}`} onClick={() => { setActiveTab('blog'); setIsMobileMenuOpen(false); }}>Blog</Link>
              <Link to="/contact" className={`new-nav-link ${activeTab === 'contact' ? 'active' : ''}`} onClick={() => { setActiveTab('contact'); setIsMobileMenuOpen(false); }}>Contact</Link>
              <Link to="/login" className={`new-nav-link ${activeTab === 'login' ? 'active' : ''}`} onClick={() => { setActiveTab('login'); setIsMobileMenuOpen(false); }}>Login</Link>
            </nav>
            <div className="new-nav-actions">
              <a href="tel:91-93-911-911" className="mobile-phone-link">
                <Phone size={16} />
                <span>91-93-911-911</span>
              </a>
              <button className="new-login-btn hidden-mobile" onClick={() => navigate('/login')}>Login</button>
              <button className="new-book-btn hidden-mobile" onClick={() => window.open('https://play.google.com/store/apps/details?id=com.rydon24.user', '_blank')}>Book a Taxi</button>
              <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? '✕' : '☰'}
              </button>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <section id="home" className="new-hero-section">
          <div className="new-hero-left">
            <span className="new-hero-subtitle">Travel securely with us!</span>
            <h1 className="new-hero-title">Book your taxi from<br />anywhere today!</h1>
            <p className="new-hero-desc">Everything your taxi business needs is already here!<br />Rydon made for taxi service companies!</p>
            <div className="new-hero-cta-row">
              <button className="new-hero-action-btn" onClick={() => window.open('https://play.google.com/store/apps/details?id=com.rydon24.user', '_blank')}>Book Your Ride</button>
              <button className="new-hero-login-btn" onClick={() => navigate('/login')}>
                <LogIn size={18} />
                <span>Login</span>
              </button>
            </div>
          </div>

          <div className="new-hero-graphic">
            <div className="new-hero-ribbon"></div>
            <img src={newHeroTaxiImg} alt="Taxi" className="new-hero-taxi" />
          </div>


        </section>
      </div>

      {/* Services Section */}
      <section id="services" className="subscriptions-section">
        <div className="section-header">
          <h2 className="section-title">OUR SERVICES</h2>
          <div className="section-triangle"></div>
        </div>

        <div className="subscriptions-grid">
          {/* Card 1 */}
          <div className="sub-card yellow">
            <h3>TAXI SERVICE</h3>
            <p>Comfortable and safe city rides to any destination you want to go with our professional drivers.</p>
            <div className="sub-card-image">
              <img src={rideImg} alt="City Taxi" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="sub-card yellow">
            <h3>BIKE RIDE</h3>
            <p>Beat the traffic and reach your destination faster with our quick and affordable bike taxi service.</p>
            <div className="sub-card-image">
              <img src={bikeImg} alt="Bike Ride" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="sub-card yellow">
            <h3>PARCEL DELIVERY</h3>
            <p>Fast and reliable parcel delivery services to send packages across the city securely.</p>
            <div className="sub-card-image">
              <img src={parcelImg} alt="Parcel Delivery" />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section">
        <div className="benefits-container">
          <div className="section-header">
            <h2 className="section-title">SOME BENEFITS</h2>
            <div className="section-triangle"></div>
          </div>

          <div className="benefits-grid">
            <div className="benefit-item">
              <div className="benefit-icon">
                <Home strokeWidth={2.5} />
              </div>
              <div className="benefit-content">
                <h3>HOME PICKUP</h3>
                <p>We run do home pickup to serve you more better and to your convenience</p>
              </div>
            </div>

            <div className="benefit-item">
              <div className="benefit-icon">
                <Gift strokeWidth={2.5} />
              </div>
              <div className="benefit-content">
                <h3>BONUSES FOR RIDE</h3>
                <p>When you book us frequently we give you different bonuses that can put a smile on your face</p>
              </div>
            </div>

            <div className="benefit-item">
              <div className="benefit-icon">
                <Clock strokeWidth={2.5} />
              </div>
              <div className="benefit-content">
                <h3>FAST BOOKING</h3>
                <p>Our book method is very fast and easy. It won't stress you.</p>
              </div>
            </div>

            <div className="benefit-item">
              <div className="benefit-icon">
                <Map strokeWidth={2.5} />
              </div>
              <div className="benefit-content">
                <h3>GPS SEARCHING</h3>
                <p>We run GPS searching incase you aren't sure of your destination. So you don't have to worry.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-login-section">
        <div className="landing-login-card">
          <div className="landing-login-copy">
            <p className="landing-login-eyebrow">Account Access</p>
            <h2>Login from the homepage to manage rides, bookings, refunds, and support requests.</h2>
            <p>
              Sign in to view trip history, track active services, update your account,
              and reach support faster from one place.
            </p>
          </div>
          <div className="landing-login-actions">
            <button className="landing-login-primary" onClick={() => navigate('/login')}>
              <LogIn size={18} />
              <span>Go to Login</span>
            </button>
            <button className="landing-login-secondary" onClick={() => navigate('/signup')}>
              Create Account
            </button>
          </div>
        </div>
      </section>

      {/* Check Us Out Section */}
      <section className="check-us-out-section">
        <div className="section-header">
          <h2 className="section-title">CHECK US OUT</h2>
          <div className="section-triangle"></div>
        </div>

        <div className="check-us-out-card">
          <div className="check-us-out-image-wrapper">
            <img src={checkUsOutImg} alt="Check Us Out" className="check-us-out-img" />
          </div>
          <div className="check-us-out-content">
            <h3 className="check-us-out-title">Join the Buddy Service Community</h3>
            <p className="check-us-out-desc">
              Follow us on social media to get the latest updates, exclusive offers, and behind-the-scenes content.
              Be part of the fastest growing transportation network in the region.
            </p>
            <div className="check-us-out-socials-container">
              <a
                href="https://www.facebook.com/people/Rydon24/61590718764212"
                target="_blank"
                rel="noopener noreferrer"
                className="check-social-item facebook"
                aria-label="Facebook"
              >
                <div className="check-social-btn facebook">
                  <FacebookIcon size={24} />
                </div>
                <span className="check-social-label">Facebook</span>
              </a>
              <a
                href="https://www.instagram.com/rydon24official?igsh=MWQ3cWoxazJ1ZGV1OQ%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="check-social-item instagram"
                aria-label="Instagram"
              >
                <div className="check-social-btn instagram">
                  <InstagramIcon size={24} />
                </div>
                <span className="check-social-label">Instagram</span>
              </a>
              <a
                href="https://www.linkedin.com/company/124914072/admin/dashboard/"
                target="_blank"
                rel="noopener noreferrer"
                className="check-social-item linkedin"
                aria-label="LinkedIn"
              >
                <div className="check-social-btn linkedin">
                  <LinkedinIcon size={24} />
                </div>
                <span className="check-social-label">LinkedIn</span>
              </a>
              <a
                href="https://youtube.com/@rydon24official?si=RfVhOYUay--g9BhB"
                target="_blank"
                rel="noopener noreferrer"
                className="check-social-item youtube"
                aria-label="YouTube"
              >
                <div className="check-social-btn youtube">
                  <YoutubeIcon size={24} />
                </div>
                <span className="check-social-label">YouTube</span>
              </a>
            </div>
            <div className="check-us-out-links">
              {appLinks.map((link, index) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`check-us-out-link ${index === 0 ? 'primary' : 'secondary'}`}
                >
                  <Download size={18} />
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer Section (New) */}
      <footer id="contact" className="new-landing-footer">
        <div className="footer-newsletter-banner">
          <div className="newsletter-image">
            <img src={heroImg} alt="Subscribe" />
          </div>
          <div className="newsletter-content">
            <div className="newsletter-bg-slant"></div>
            <div className="newsletter-text">
              <h4 className="newsletter-subtitle"><Car size={16} /> GET TO ACCESS</h4>
              <h3 className="newsletter-title">Subscribe Our Newsletter.</h3>
              <form className="newsletter-form">
                <input type="email" placeholder="Email" />
                <button type="button" onClick={() => window.open('https://play.google.com/store/apps/details?id=com.rydon24.user', '_blank')}>Book Now →</button>
              </form>
            </div>
          </div>
        </div>

        <div className="footer-main-content">
          <div className="footer-col-1">
            <a href="/" className="footer-logo">
              <span style={{ color: '#FFB300', fontSize: '2.5rem', fontWeight: 800 }}>Rydon</span><span style={{ color: '#fff', fontSize: '2.5rem', fontWeight: 800 }}>24</span>
            </a>
            <p>We provide the best taxi and ride services in the region. Reliable, fast, and secure rides at your fingertips.</p>
            <p>Our fleet consists of well-maintained vehicles driven by professional drivers to ensure a comfortable journey.</p>
            <div className="footer-socials-container">
              <a
                href="https://www.facebook.com/people/Rydon24/61590718764212"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-item facebook"
                aria-label="Facebook"
              >
                <div className="social-icon facebook">
                  <FacebookIcon size={18} />
                </div>
                <span className="social-label">Facebook</span>
              </a>
              <a
                href="https://www.instagram.com/rydon24official?igsh=MWQ3cWoxazJ1ZGV1OQ%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-item instagram"
                aria-label="Instagram"
              >
                <div className="social-icon instagram">
                  <InstagramIcon size={18} />
                </div>
                <span className="social-label">Instagram</span>
              </a>
              <a
                href="https://www.linkedin.com/company/124914072/admin/dashboard/"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-item linkedin"
                aria-label="LinkedIn"
              >
                <div className="social-icon linkedin">
                  <LinkedinIcon size={18} />
                </div>
                <span className="social-label">LinkedIn</span>
              </a>
              <a
                href="https://youtube.com/@rydon24official?si=RfVhOYUay--g9BhB"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-item youtube"
                aria-label="YouTube"
              >
                <div className="social-icon youtube">
                  <YoutubeIcon size={18} />
                </div>
                <span className="social-label">YouTube</span>
              </a>
            </div>
          </div>
          <div className="footer-col-2">
            <h3>Quick Links</h3>
            <ul>
              <li><Link to="/terms">Terms & Conditions</Link></li>
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/refund">Refund Policy</Link></li>
              <li><Link to="/cancellation">Cancellation Policy</Link></li>
              <li><Link to="/contact">Contact Us</Link></li>
              <li><Link to="/about">About Us</Link></li>
            </ul>
          </div>
          <div className="footer-col-3">
            <h3>Our Services</h3>
            <ul>
              {serviceNames.map((serviceName) => (
                <li key={serviceName}><Link to="/login">{serviceName}</Link></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div className="footer-legal">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms & Conditions</Link>
          </div>
          <div className="footer-copyright">
            Copyright 2026 © All Right Reserved Design by Buddy Service
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
