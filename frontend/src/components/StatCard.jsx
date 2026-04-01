import { useEffect, useState, useRef } from 'react';

export default function StatCard({ label, value, isDecimal = false, suffix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  
  useEffect(() => {
    let observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        let current = 0;
        const target = parseFloat(value);
        const increment = target / 40; 
        
        const interval = setInterval(() => {
          current += increment;
          if (current >= target) {
            setCount(target);
            clearInterval(interval);
          } else {
            setCount(current);
          }
        }, 30);
      }
    }, { threshold: 0.3 });
    
    if (ref.current) observer.observe(ref.current);
    
    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, [value]);

  return (
    <div ref={ref} className="flex flex-col items-center justify-center p-8 border border-cyan-400/20 bg-black rounded-lg">
      <div className="text-5xl font-bold text-white mb-2">
        {isDecimal ? count.toFixed(2) : Math.floor(count)}{suffix}
      </div>
      <div className="text-gray-400 uppercase tracking-widest text-xs mt-2">{label}</div>
    </div>
  );
}
