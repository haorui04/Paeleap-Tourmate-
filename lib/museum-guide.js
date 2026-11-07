export const MUSEUM_GUIDE_ID = 'little-de-rabbit';
export const GUIDE_ORIGIN = 'https://paeleap-chatbot-test.vercel.app';
export const exhibitLink = id => `/?persona=${MUSEUM_GUIDE_ID}&artifact=${encodeURIComponent(id)}`;

const stop = (id, group, en, zh) => ({ id, group, name: { en, zh } });
export const exhibits = [
  stop('DS004', 'architecture', 'Chonghua Hall and the thrones', '重华殿与双座陈设'),
  stop('DS005', 'ceramics', 'Longquan seven-tube hexagonal flower vessel', '龙泉窑青釉六方七管占景盆'),
  stop('DS007', 'ceramics', 'Guan pale-celadon goose-neck vase', '官窑粉青釉鹅颈瓶'),
  stop('DS008', 'ceramics', 'Longquan pale-celadon long-neck vase', '龙泉窑粉青釉长颈瓶'),
  stop('DS009', 'ceramics', 'Southern Song Guan celadon flower gu', '南宋官窑青釉花觚'),
  stop('DS010', 'daily', 'Jian tea bowls', '建盏'),
  stop('DS011', 'daily', 'Pottery gaming pieces with bird decoration', '带禽鸟纹的陶制棋子'),
  stop('DS012', 'ceramics', 'Cloud-and-dragon drum-stool fragment', '刻划云龙纹鼓凳残片'),
  stop('DS013', 'ceramics', 'Han bottles', '韩瓶'),
  stop('DS014', 'architecture', 'Beast-mask eaves tile', '兽面纹瓦当'),
  stop('DS015', 'ceramics', 'Guan paper-mallet-shaped vase', '南宋官窑纸槌瓶'),
  stop('DS016', 'architecture', 'Taihu stones, paving bricks and column bases', '太湖石、香糕砖与柱础'),
  stop('DS017', 'architecture', 'Drains, ponds, paths and foundations', '排水沟、水池、道路与台基'),
  stop('DS019', 'architecture', 'Digital projections and Little West Lake', '数字投影与小西湖')
];

export const tours = [
  { id: 'highlights', name: { en: 'Palace highlights', zh: '德寿宫精华' }, ids: ['DS004','DS014','DS005','DS017'] },
  { id: 'ruins', name: { en: 'Architecture & ruins', zh: '建筑与遗址' }, ids: ['DS004','DS014','DS016','DS017','DS019'] },
  { id: 'objects', name: { en: 'Ceramics & daily life', zh: '瓷器与宋人生活' }, ids: ['DS005','DS009','DS010','DS011'] },
  { id: 'family', name: { en: 'Family discovery trail', zh: '亲子探索路线' }, ids: ['DS005','DS014','DS011'] }
];

export const reportReasons = ['match', 'translation', 'details'];
export const reportLabels = {
  match: { en: 'Incorrect artifact match', zh: '文物匹配有误' },
  translation: { en: 'Unclear translation', zh: '翻译不清晰' },
  details: { en: 'Incorrect or outdated detail', zh: '说明有误或已过时' }
};

export function speechPages(text) {
  return (text.match(/[^.!?。！？]+[.!?。！？]*|[.!?。！？]+/gu) || []).map(sentence => sentence.trim()).filter(Boolean);
}
