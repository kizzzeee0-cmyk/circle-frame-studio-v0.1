// Intentionally pastel-forward curated sets; these are suggested HEX
// combinations, not AI-estimated colors. All are editable before export.
export const PALETTE_PRESETS=Object.freeze([
  {group:'포근한 파스텔',label:'라벤더 · 벚꽃 · 민트',colors:['#BEB5ED','#F2BFD1','#B8DECB']},
  {group:'포근한 파스텔',label:'버터옐로우 · 연두 · 크림',colors:['#F4DDA1','#C6D99A','#FFF1D8']},
  {group:'포근한 파스텔',label:'딸기우유 · 바닐라 · 화이트',colors:['#F1B5CC','#F9DCA9','#FDF9F3']},
  {group:'포근한 파스텔',label:'밀키블루 · 연보라 · 화이트',colors:['#BBD7F1','#CBC3EC','#F8F7FC']},
  {group:'포근한 파스텔',label:'피치 · 살구 · 밀크',colors:['#F3C3B5','#F5D4B1','#FFF0E7']},
  {group:'포근한 파스텔',label:'라일락 · 크림민트 · 아이보리',colors:['#D3C0EA','#D5E9D8','#FAF6EE']},
  {group:'포근한 파스텔',label:'장미 · 애쉬핑크 · 크림',colors:['#EAB0BA','#D8B9C6','#F7E7D8']},
  {group:'포근한 파스텔',label:'연두 · 소프트그레이 · 바닐라',colors:['#C9DBAE','#D9D7D2','#F7E8C6']},
  {group:'달콤한 캔디',label:'코튼캔디 4색',colors:['#E9B9D3','#B4CDEB','#C6E5D8','#F6D8B8']},
  {group:'달콤한 캔디',label:'마카롱 5색',colors:['#E7BAD1','#D1C7F0','#AFDBD1','#F4D9A7','#F2C5BA']},
  {group:'달콤한 캔디',label:'말랑젤리 핑크 · 그레이프',colors:['#F0B9CC','#C8B4E7','#F5D8E1']},
  {group:'달콤한 캔디',label:'크림소다 민트 · 스카이',colors:['#BBE5D8','#BCDFF2','#F8EFCF']},
  {group:'달콤한 캔디',label:'멜론 · 버터 · 피치',colors:['#CFE3AD','#F5E0A8','#F0C9BC']},
  {group:'달콤한 캔디',label:'라즈베리 · 밀키핑크 · 코코아',colors:['#E7A2B9','#F7D6DF','#AB8B85']},
  {group:'달콤한 캔디',label:'소다 · 레몬 · 크림',colors:['#AFCDE5','#F4E2A4','#F9F4E8']},
  {group:'달콤한 캔디',label:'솜사탕 파스텔 6색',colors:['#ECC2DB','#D3C2F0','#BAD5F0','#BDE5D9','#F4E1B1','#F5C8B9']},
  {group:'자연 · 포근함',label:'네잎클로버 · 별',colors:['#AFCB8B','#E5D28E','#E9DCEE','#F6F1E7']},
  {group:'자연 · 포근함',label:'라벤더 정원',colors:['#BAAFE0','#D7C9E9','#B9CFB4','#F4EEDD']},
  {group:'자연 · 포근함',label:'피스타치오 · 오트밀',colors:['#BACDA8','#E5DBC6','#F7F1E5']},
  {group:'자연 · 포근함',label:'블루베리 · 크림',colors:['#A8B9D8','#CFC5E5','#EEE8DD']},
  {group:'자연 · 포근함',label:'봄꽃 화단',colors:['#F0BDC5','#C5DDB9','#F2E5AD','#CECAE9']},
  {group:'자연 · 포근함',label:'차분한 세이지 · 베이지',colors:['#ACC4AE','#CFCEBE','#EDE4D6']},
  {group:'자연 · 포근함',label:'살구빛 노을',colors:['#EABDB2','#E9D2BE','#D9CBD8']},
  {group:'자연 · 포근함',label:'바다유리 · 미스트',colors:['#AFD1D2','#C6DBE5','#DBE1DF']},
  {group:'차분한 뉴트럴',label:'핑크 · 소프트차콜 · 그레이',colors:['#E5ACBC','#817F8A','#DCD9DF']},
  {group:'차분한 뉴트럴',label:'라벤더그레이 · 크림',colors:['#BBB4C8','#E9E3E7','#F6F1E7']},
  {group:'차분한 뉴트럴',label:'샌드 · 모카 · 라떼',colors:['#E7CFB8','#B99E90','#F4EBE2']},
  {group:'차분한 뉴트럴',label:'쿨그레이 · 블루 · 화이트',colors:['#D4D9E2','#B4CBE0','#F7F8FA']},
  {group:'차분한 뉴트럴',label:'로즈 · 세이지 · 아이보리',colors:['#D8ACAF','#B3C5B1','#F5F1E9']},
  {group:'차분한 뉴트럴',label:'차콜 · 옅은 로즈 · 아이보리',colors:['#7C7880','#E8C7D1','#FBF8F2']},
]);
export function paletteByLabel(label){
  return PALETTE_PRESETS.find(p=>p.label===label)||null;
}
