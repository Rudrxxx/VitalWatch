import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import StatCard from '../components/StatCard';

// 3D Scene internal component
function BackgroundScene() {
  const groupRef = useRef();
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05;
      groupRef.current.rotation.x += delta * 0.02;
    }
  });

  const [particles] = useState(() => {
    const coords = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) {
        const r = 3 * Math.cbrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        coords[i*3] = r * Math.sin(phi) * Math.cos(theta);
        coords[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        coords[i*3+2] = r * Math.cos(phi);
    }
    return coords;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[2, 4]} />
        <meshBasicMaterial color="#00E5FF" wireframe transparent opacity={0.2} />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={200} array={particles} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color="#00E5FF" size={0.04} transparent opacity={0.8} />
      </points>
    </group>
  );
}

// ECG Animation
function AnimatedECG() {
  return (
    <div className="absolute bottom-0 left-0 w-full h-[60px] bg-black pointer-events-none">
       <svg className="w-full h-full opacity-60" viewBox="0 0 1000 60" preserveAspectRatio="none">
          <motion.path 
            d="M 0 30 L 200 30 L 210 10 L 230 50 L 250 15 L 260 30 L 500 30 L 510 10 L 530 50 L 550 15 L 560 30 L 800 30 L 810 10 L 830 50 L 850 15 L 860 30 L 1000 30"
            fill="transparent"
            stroke="white"
            strokeWidth="1.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />
       </svg>
    </div>
  );
}

export default function LandingPage() {
  const [scrollData, setScrollData] = useState({ opacity: 1, scale: 1 });

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const opacity = Math.max(0, 1 - scrollY / 600);
      const scale = Math.max(0.8, 1 - scrollY / 1000);
      setScrollData({ opacity, scale });
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="bg-black min-h-screen pt-16">
      
      {/* SECTION 1: HERO */}
      <section className="relative w-full h-[calc(100vh-64px)] bg-black flex items-center justify-center overflow-hidden">
        
        {/* Three.js Canvas Background */}
        <div 
          className="absolute inset-0 z-0 pointer-events-auto" 
          style={{ 
            opacity: scrollData.opacity, 
            transform: `scale(${scrollData.scale})`
          }}
        >
          <Canvas camera={{ position: [0, 0, 5.5] }}>
            <BackgroundScene />
            <OrbitControls enableZoom={false} autoRotate={false} />
          </Canvas>
        </div>

        {/* Text Overlay */}
        <div className="relative z-10 flex flex-col items-center text-center px-4 pointer-events-none w-full">
          <div className="text-[#00E5FF] tracking-[0.3em] text-xs mb-8 uppercase font-bold">
            Surgical AI Intelligence
          </div>
          
          <div className="flex flex-col space-y-4 mb-10 w-full items-center">
            {['Predict.', 'Explain.', 'Save Lives.'].map((text, i) => (
              <motion.div
                key={text}
                className="text-6xl md:text-7xl font-bold text-white w-full"
                style={{ textShadow: '0 4px 20px rgba(0, 229, 255, 0.15)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: i * 0.4 }}
              >
                {text}
              </motion.div>
            ))}
          </div>

          <div className="text-gray-400 text-xs md:text-sm mt-2 max-w-lg mb-12 uppercase tracking-widest">
            Early warning system for intraoperative hypotension &middot; AUC-ROC 0.91 &middot; 6,388 patients
          </div>

          <Link to="/monitor" className="pointer-events-auto border border-cyan-400 bg-cyan-400/5 text-cyan-400 px-10 py-4 hover:bg-cyan-400 hover:text-black transition uppercase tracking-widest text-sm font-bold">
            Enter Dashboard &rarr;
          </Link>
        </div>

        <AnimatedECG />
      </section>

      {/* SECTION 2: STATS */}
      <section className="bg-black py-24 px-6 border-t border-white/10 relative z-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <StatCard value={6388} label="Patients" />
            <StatCard value={0.91} label="AUC-ROC" isDecimal />
            <StatCard value={5} label="Min Early Warning" suffix="+" />
        </div>
      </section>

      {/* SECTION 3: FEATURES */}
      <section className="bg-[#0a0a0a] py-32 px-6 relative z-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="border-l-4 border-cyan-400 bg-black p-8 rounded-r-2xl shadow-xl transition hover:transform hover:-translate-y-2">
                <h3 className="text-cyan-400 font-bold mb-4 uppercase tracking-widest text-sm">Real-time Prediction</h3>
                <p className="text-gray-400 text-sm leading-relaxed">Continuous screening of live vital signs with up to a 5-minute early warning head-start prior to hypotensive crisis.</p>
            </div>
            <div className="border-l-4 border-cyan-400 bg-black p-8 rounded-r-2xl shadow-xl transition hover:transform hover:-translate-y-2">
                <h3 className="text-cyan-400 font-bold mb-4 uppercase tracking-widest text-sm">SHAP Explainability</h3>
                <p className="text-gray-400 text-sm leading-relaxed">Every alert algorithmically explained. Reject the black box. See immediately which biometric shifts are spiking the risk profile.</p>
            </div>
            <div className="border-l-4 border-cyan-400 bg-black p-8 rounded-r-2xl shadow-xl transition hover:transform hover:-translate-y-2">
                <h3 className="text-cyan-400 font-bold mb-4 uppercase tracking-widest text-sm">Clinical RAG AI</h3>
                <p className="text-gray-400 text-sm leading-relaxed">An intelligent integrated medical assistant anchored entirely to clinically validated perioperative documentation.</p>
            </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black border-t border-white/5 text-gray-600 text-center py-10 tracking-widest uppercase text-xs">
        VitalWatch 2.0 &middot; Built on VitalDB &middot; AI For Precision Medicine
      </footer>
    </div>
  );
}
