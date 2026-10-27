import type { RawRow } from "./normalize";

// Stand-in for a parsed spreadsheet while the import UI is built (stage 1).
// Real file parsing (SheetJS) replaces this in stage 3; everything after parsing stays.
// Fictional data: messy headers and values on purpose, like a hand-made Google Sheet.

export const DEMO_TABLE: { headers: string[]; rows: RawRow[] } = {
  headers: ["Работодатель", "Вакансия", "Статус", "Когда откликнулся", "Зарплата", "Где нашёл", "Комментарий", "Кто посоветовал"],
  rows: [
    ["ООО «Ромашка Тех»", "React Developer", "собеседование", "15.10.2026", "250-280к", "LinkedIn", "Позвали на техсобес 30 окт", ""],
    ["Облако-9", "TypeScript Engineer", "отклик", "02.05.2026", "", "hh.ru", "", "Игорь"],
    ["Пиксель и Ко", "UI Engineer", "отказ", "03.10.2026", "от 200 000 ₽", "hh.ru", "", ""],
    ["Звезда Девелопмент", "Frontend Engineer", "ждём ответа", "21.10.2026", "от 3000$", "Telegram-канал", "Нашёл через канал вакансий", "Аня"],
    ["Кедр Лабс", "Middle Frontend", "тестовое", "2026-10-19", "180–220 тыс", "hh.ru", "", ""],
    ["Маяк Финтех", "Frontend-разработчик", "", "17/10/2026", "", "Сайт компании", "", ""],
    ["", "Junior Frontend", "отклик", "20.10.2026", "", "hh.ru", "", ""],
  ],
};
