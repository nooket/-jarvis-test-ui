# JARVIS TEST — GitHub Pages

ใช้แทน Netlify ชั่วคราว เพราะทีม Netlify ถูกพักการ deploy จากเครดิต

บน iPad:
1. GitHub > New repository
2. ตั้งชื่อเช่น `jarvis-test-ui`
3. Add file > Upload files
4. อัปโหลด `index.html` และ `.nojekyll`
5. Settings > Pages
6. Source: Deploy from a branch
7. Branch: main / root
8. Save
9. รอประมาณ 1-3 นาที แล้วเปิด URL ที่ GitHub Pages แสดง

Backend ยังคงเป็น Supabase TEST เดิม
ไม่มี service role หรือ secret ใน frontend
