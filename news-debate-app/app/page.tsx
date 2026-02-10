'use client';
import { usePathname } from 'next/navigation';

export default function Home() {
  const pathname = usePathname(); // ← PATH נוכחי
  
  return (
    <div>
      <h1>📰 Controversy News</h1>
      <p>נמצא ב: /app </p> {/* ← DEBUG */}
      
      {/* שאר הקוד... */}
    </div>
  );
}
