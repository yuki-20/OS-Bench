import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function RouteCleanup() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Route components own their ScrollTrigger cleanup. Killing everything here
    // can leave gsap.from() sections hidden after navigation.
    window.scrollTo(0, 0);
    const timer = setTimeout(() => ScrollTrigger.refresh(), 50);
    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
