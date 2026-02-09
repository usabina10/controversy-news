export async function generateDebateAudio(newsTitle: string, newsDesc: string) {
  // זיהוי נושאים
  const topics = {
    benGvir: newsTitle.includes('בן גביר'),
    netanyahu: newsTitle.includes('נתניהו'),
    fines: newsTitle.includes('קנסות'),
    phone: newsTitle.includes('טלפון'),
    security: newsTitle.includes('ביטחון') || newsTitle.includes('בטיחות')
  };

  const factText = `חדשות: ${newsTitle}\n\nפרטים: ${newsDesc.substring(0, 250)}...`;

  // 🟥 ימין - מבוסס נושא
  const rightText = `🟥 פרשנות ימנית
מקורות: Israel Hayom • JPost • Makor Rishon

${topics.benGvir ? '✅ בן גביר צודק! 78 עבירות = ניסיון אישי' : ''}
${topics.fines ? '✅ קנסות גבוהים = פתרון אמיתי לתאונות!' : ''}
${topics.netanyahu ? '✅ נתניהו מוכיח מנהיגות!' : ''}
${topics.security ? '🛡️ צריך קשיחות מול סיכונים!' : ''}

הגישה הנחרצת עובדת 🇮🇱`;

  // 🟦 שמאל - מבוסס נושא
  const leftText = `🟦 פרשנות שמאלנית
מקורות: Haaretz • TOI • +972 Magazine

${topics.benGvir ? '❌ בן גביר היפוקריט! 78 עבירות תנועה' : ''}
${topics.fines ? '❌ קנסות מטורפים פוגעים בעניים!' : ''}
${topics.netanyahu ? '❌ נתניהו מסכן את המדינה!' : ''}
${topics.security ? '❌ צריך גישה מתונה!' : ''}

פתרון דיפלומטי נדרש ⚖️`;

  return {
    factText,
    rightText,
    leftText,
    factAudio: '',
    rightAudio: '',
    leftAudio: ''
  };
}
