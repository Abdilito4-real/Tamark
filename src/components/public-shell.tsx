import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MobileDrawer } from "@/components/mobile-drawer";
import { BrandMark } from "@/components/brand-mark";
import { CookiePreferencesLink } from "@/components/cookie-consent";

const publicLinks = [
  ["About", "/#about"],
  ["Services", "/#services"],
  ["Training", "/training"],
  ["Contact", "/#contact"],
];

export function PublicHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/" aria-label="Tamark Solar Energy home">
          <BrandMark />
          <span>TAMARK<small>SOLAR ENERGY</small></span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {publicLinks.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
          <Link className="button button-outline button-small" href="/student">Student portal</Link>
          <Link className="button button-primary button-small" href="/apply">Apply for training</Link>
        </nav>
        <MobileDrawer id="public-navigation" label="Menu" triggerLabel="Open navigation menu" className="public-drawer">
          <nav aria-label="Mobile navigation">
            <Link href="/">Home</Link>
            {publicLinks.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
            <Link href="/sign-in">Login</Link>
            <Link href="/student">Student portal</Link>
            <Link className="button button-primary" href="/apply">Apply for training <ArrowUpRight size={15} /></Link>
          </nav>
        </MobileDrawer>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link className="brand brand-footer" href="/">
              <BrandMark />
              <span>TAMARK<small>SOLAR ENERGY</small></span>
            </Link>
            <p>Solar energy solutions and practical technical training.</p>
          </div>
          <div><h2>Explore</h2><Link href="/#about">About us</Link><Link href="/#services">Services</Link><Link href="/training">Training</Link></div>
          <div><h2>Student</h2><Link href="/apply">Apply for training</Link><Link href="/student">Student portal</Link><Link href="/student/applications">Applications</Link></div>
          <div><h2>Information</h2><Link href="/#contact">Contact</Link><Link href="/terms-and-conditions">Terms and Conditions</Link><Link href="/privacy-policy">Privacy Policy</Link><Link href="/cookie-policy">Cookie Policy</Link><CookiePreferencesLink /><span>Contact details will be published when confirmed.</span></div>
        </div>
        <div className="footer-bottom">© {new Date().getFullYear()} Tamark Solar Energy</div>
      </div>
    </footer>
  );
}
