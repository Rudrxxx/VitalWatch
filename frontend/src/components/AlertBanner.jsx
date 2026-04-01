import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export default function AlertBanner({ shown }) {
    return (
        <AnimatePresence>
            {shown && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="w-full bg-red-950 border-y border-red-500 py-3 px-6 flex items-center justify-center space-x-3 overflow-hidden z-40 relative shadow-lg"
                >
                    <AlertTriangle className="text-red-500 animate-pulse w-6 h-6 shrink-0" />
                    <span className="text-white font-bold tracking-widest uppercase font-mono text-xs md:text-sm">
                        ⚠ CRITICAL — IOH PREDICTED WITHIN 1 MINUTE
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
