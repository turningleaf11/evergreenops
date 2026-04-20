export interface Quote {
  quote: string;
  author: string;
}

export const QUOTES: Quote[] = [
  { quote: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { quote: "Don't wait to buy real estate. Buy real estate and wait.", author: "Will Rogers" },
  { quote: "Discipline equals freedom.", author: "Jocko Willink" },
  { quote: "What gets measured gets managed.", author: "Peter Drucker" },
  { quote: "It is not the strongest who survives, but the one most adaptable to change.", author: "Charles Darwin" },
  { quote: "Compound interest is the eighth wonder of the world.", author: "Albert Einstein" },
  { quote: "The successful warrior is the average person, with laser-like focus.", author: "Bruce Lee" },
  { quote: "Slow is smooth. Smooth is fast.", author: "Navy SEAL Adage" },
  { quote: "Either you run the day or the day runs you.", author: "Jim Rohn" },
  { quote: "Twenty years from now you will be more disappointed by the things you didn't do than by the ones you did.", author: "Mark Twain" },
  { quote: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { quote: "Real estate is an imperishable asset, ever-increasing in value.", author: "Theodore Roosevelt" },
  { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { quote: "If you want to go fast, go alone. If you want to go far, go together.", author: "African Proverb" },
  { quote: "What you do every day matters more than what you do once in a while.", author: "Gretchen Rubin" },
  { quote: "Buy land, they're not making it anymore.", author: "Mark Twain" },
  { quote: "A leader is one who knows the way, goes the way, and shows the way.", author: "John C. Maxwell" },
  { quote: "Hard choices, easy life. Easy choices, hard life.", author: "Jerzy Gregorek" },
  { quote: "You don't rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  { quote: "The market can stay irrational longer than you can stay solvent.", author: "John Maynard Keynes" },
  { quote: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { quote: "Vision without execution is hallucination.", author: "Thomas Edison" },
  { quote: "Take care of the days, and the years will take care of themselves.", author: "Maria Edgeworth" },
  { quote: "The best investment on Earth is earth.", author: "Louis Glickman" },
  { quote: "Quality is never an accident; it is always the result of intelligent effort.", author: "John Ruskin" },
  { quote: "Move fast and fix things.", author: "Anonymous" },
  { quote: "Owning a home is a keystone of wealth — both financial affluence and emotional security.", author: "Suze Orman" },
  { quote: "Don't let perfect be the enemy of good.", author: "Voltaire" },
  { quote: "The pessimist complains about the wind; the optimist expects it to change; the realist adjusts the sails.", author: "William Arthur Ward" },
  { quote: "Bet on yourself. Bet often.", author: "Anonymous" },
];

export function getDailyQuote(): Quote {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = Date.now() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return QUOTES[dayOfYear % QUOTES.length];
}

export function getRandomQuote(exclude?: Quote): Quote {
  if (QUOTES.length <= 1) return QUOTES[0];
  let q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  while (exclude && q.quote === exclude.quote) {
    q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  }
  return q;
}
