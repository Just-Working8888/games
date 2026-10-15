/** Visual chapters repeat every twenty levels, independently of puzzle difficulty. */
export function worldFor(level: number) {
  const dawn = Math.floor((Math.max(1, level) - 1) / 10) % 2 === 1;
  return { id: dawn ? 'dawn' : 'moon', name: dawn ? 'Долина рассвета' : 'Лунная лагуна', chapter: Math.floor((Math.max(1, level) - 1) / 10) + 1, step: ((Math.max(1, level) - 1) % 10) + 1 };
}
