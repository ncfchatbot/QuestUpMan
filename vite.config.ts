
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // ใช้ตัวเลือกที่ปลอดภัยกว่าในการแทนที่ค่า
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || "")
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // ป้องกันปัญหาเรื่องชื่อไฟล์บนบางระบบ
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
