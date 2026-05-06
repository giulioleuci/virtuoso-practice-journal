// Inspirational quotes used in narrative empty states.
export interface Quote {
  text: string;
  author: string;
}

export const PRACTICE_QUOTES: Quote[] = [
  { text: "Without music, life would be a mistake.", author: "Friedrich Nietzsche" },
  { text: "To play a wrong note is insignificant; to play without passion is inexcusable.", author: "Ludwig van Beethoven" },
  { text: "Music is the silence between the notes.", author: "Claude Debussy" },
  { text: "Practice puts brains in your muscles.", author: "Sam Snead" },
  { text: "When you play, never mind who listens to you.", author: "Robert Schumann" },
  { text: "Music gives a soul to the universe, wings to the mind.", author: "Plato" },
  { text: "An artist must practice what they love, even alone in the morning.", author: "Pablo Casals" },
];

export const LESSON_QUOTES: Quote[] = [
  { text: "A good teacher can inspire hope, ignite the imagination, and instill a love of learning.", author: "Brad Henry" },
  { text: "I am indebted to my father for living, but to my teacher for living well.", author: "Alexander the Great" },
  { text: "The teacher who is indeed wise does not bid you to enter the house of his wisdom but leads you to the threshold of your own mind.", author: "Kahlil Gibran" },
  { text: "Teaching is the highest form of understanding.", author: "Aristotle" },
];

export const LIBRARY_QUOTES: Quote[] = [
  { text: "The notes I handle no better than many pianists. But the pauses — ah, that is where the art resides.", author: "Arthur Schnabel" },
  { text: "A composer is a guy who goes around forcing his will on unsuspecting air.", author: "Aaron Copland" },
  { text: "Music expresses that which cannot be put into words and that which cannot remain silent.", author: "Victor Hugo" },
];

export function pickQuote(pool: Quote[] = PRACTICE_QUOTES): Quote {
  return pool[Math.floor(Math.random() * pool.length)];
}
