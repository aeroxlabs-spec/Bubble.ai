
import React from 'react';
import { InfoPageType } from './InfoModal';

interface FooterProps {
    onLinkClick: (page: InfoPageType) => void;
}

const Footer: React.FC<FooterProps> = ({ onLinkClick }) => {
    return (
        <footer className="w-full border-t border-white/5 bg-[#050505] mt-auto py-8">
            <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                
                <div className="text-center md:text-left">
                    <h3 className="text-sm font-bold text-white tracking-tight mb-1">Bubble.ib</h3>
                    <p className="text-[10px] text-gray-600">
                        &copy; {new Date().getFullYear()} Bubble.ib. All rights reserved.
                    </p>
                </div>

                <div className="flex items-center gap-6 sm:gap-8">
                    <button 
                        onClick={() => onLinkClick('ABOUT')}
                        className="text-xs text-gray-500 hover:text-white transition-colors uppercase tracking-wider font-bold"
                    >
                        About
                    </button>
                    <button 
                        onClick={() => onLinkClick('SERVICES')}
                        className="text-xs text-gray-500 hover:text-white transition-colors uppercase tracking-wider font-bold"
                    >
                        Services
                    </button>
                    <button 
                        onClick={() => onLinkClick('CONTACT')}
                        className="text-xs text-gray-500 hover:text-white transition-colors uppercase tracking-wider font-bold"
                    >
                        Contact
                    </button>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
