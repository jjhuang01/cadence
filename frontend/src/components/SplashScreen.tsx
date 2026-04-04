import { useEffect, useState } from 'react';
import { Disc3 } from 'lucide-react';

interface SplashScreenProps {
  visible: boolean;
}

export function SplashScreen({ visible }: SplashScreenProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!visible) {
      const t = setTimeout(() => setHidden(true), 500);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (hidden) return null;

  return (
    <div className={`splash-screen ${!visible ? 'splash-out' : ''}`}>
      <div className="splash-content">
        <div className="splash-icon">
          <Disc3 size={52} strokeWidth={1.2} />
        </div>
        <div className="splash-name">律动</div>
        <div className="splash-sub">你的音乐，你的节奏</div>
      </div>
    </div>
  );
}
