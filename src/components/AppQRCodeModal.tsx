import React, { useState, useRef } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { QrCode, Download, Copy, Check, ExternalLink, X, Smartphone, Globe, Share2 } from 'lucide-react';

interface AppQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl?: string;
}

export const AppQRCodeModal: React.FC<AppQRCodeModalProps> = ({
  isOpen,
  onClose,
  appUrl = 'https://gcu-eol.ai.studio'
}) => {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'GCU_Fresherism26_App_QRCode.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn font-sans">
      <div className="bg-[#1A032E] border-2 border-[#FF007A] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 relative text-white">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-gradient-to-br from-[#FF007A]/30 to-[#00D1FF]/30 border border-[#FF007A]/40 rounded-2xl text-[#00D1FF] mb-1 shadow-lg">
            <QrCode className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">
            GCU Fresherism '26 App
          </h2>
          <p className="text-xs text-purple-200">
            Scan with any phone camera to instantly access the live portal
          </p>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border-4 border-amber-400 shadow-xl space-y-3 relative group">
          <div ref={canvasRef} className="p-2 bg-white rounded-xl">
            <QRCodeCanvas
              value={appUrl}
              size={220}
              bgColor="#FFFFFF"
              fgColor="#1A032E"
              level="H"
              marginSize={1}
            />
          </div>
          <div className="text-center">
            <p className="text-[11px] font-mono font-bold text-purple-950 flex items-center justify-center gap-1">
              <Globe className="w-3.5 h-3.5 text-purple-700" /> {appUrl}
            </p>
          </div>
        </div>

        {/* Direct Link Banner */}
        <div className="p-3 bg-[#0F011E] rounded-2xl border border-purple-500/30 flex items-center justify-between text-xs">
          <span className="font-mono text-purple-200 truncate max-w-[220px]">
            {appUrl}
          </span>
          <button
            onClick={handleCopyLink}
            className="px-3 py-1.5 bg-purple-800/50 hover:bg-purple-700/60 text-purple-200 hover:text-white font-bold rounded-xl border border-purple-500/40 transition-all flex items-center gap-1 shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy Link
              </>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleDownloadQR}
            className="py-3 bg-gradient-to-r from-[#FF007A] to-pink-600 hover:opacity-90 text-white text-xs font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Save PNG
          </button>
          <a
            href={appUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-3 bg-gradient-to-r from-cyan-600 to-teal-500 hover:opacity-90 text-white text-xs font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-center"
          >
            <ExternalLink className="w-4 h-4" /> Open Link
          </a>
        </div>

      </div>
    </div>
  );
};
