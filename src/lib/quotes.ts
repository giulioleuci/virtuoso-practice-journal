// Inspirational quotes used in narrative empty states.
import type { Lang } from "./db";

export interface Quote {
  text: string;
  author: string;
}

type QuotePool = Record<Lang, Quote[]>;

export const PRACTICE_QUOTES: QuotePool = {
  en: [
    { text: "Without music, life would be a mistake.", author: "Friedrich Nietzsche" },
    { text: "To play a wrong note is insignificant; to play without passion is inexcusable.", author: "Ludwig van Beethoven" },
    { text: "Music is the silence between the notes.", author: "Claude Debussy" },
    { text: "Practice puts brains in your muscles.", author: "Sam Snead" },
    { text: "When you play, never mind who listens to you.", author: "Robert Schumann" },
    { text: "Music gives a soul to the universe, wings to the mind.", author: "Plato" },
    { text: "An artist must practice what they love, even alone in the morning.", author: "Pablo Casals" },
  ],
  it: [
    { text: "Senza musica, la vita sarebbe un errore.", author: "Friedrich Nietzsche" },
    { text: "Suonare una nota sbagliata è insignificante; suonare senza passione è imperdonabile.", author: "Ludwig van Beethoven" },
    { text: "La musica è il silenzio tra le note.", author: "Claude Debussy" },
    { text: "La pratica mette il cervello nei tuoi muscoli.", author: "Sam Snead" },
    { text: "Quando suoni, non preoccuparti di chi ti ascolta.", author: "Robert Schumann" },
    { text: "La musica dà un'anima all'universo, le ali alla mente.", author: "Platone" },
    { text: "Un artista deve praticare ciò che ama, anche da solo al mattino.", author: "Pablo Casals" },
  ],
  es: [
    { text: "Sin música, la vida sería un error.", author: "Friedrich Nietzsche" },
    { text: "Tocar una nota equivocada es insignificante; tocar sin pasión es imperdonable.", author: "Ludwig van Beethoven" },
    { text: "La música es el silencio entre las notas.", author: "Claude Debussy" },
    { text: "La práctica pone cerebro en tus músculos.", author: "Sam Snead" },
    { text: "Cuando toques, no te importe quién te escuche.", author: "Robert Schumann" },
    { text: "La música da alma al universo, alas a la mente.", author: "Platón" },
    { text: "Un artista debe practicar lo que ama, incluso solo por la mañana.", author: "Pablo Casals" },
  ],
  de: [
    { text: "Ohne Musik wäre das Leben ein Irrtum.", author: "Friedrich Nietzsche" },
    { text: "Eine falsche Note zu spielen ist unerheblich; ohne Leidenschaft zu spielen ist unverzeihlich.", author: "Ludwig van Beethoven" },
    { text: "Musik ist das Schweigen zwischen den Noten.", author: "Claude Debussy" },
    { text: "Übung bringt Verstand in deine Muskeln.", author: "Sam Snead" },
    { text: "Wenn du spielst, denk nicht daran, wer dir zuhört.", author: "Robert Schumann" },
    { text: "Musik gibt dem Universum eine Seele, dem Geist Flügel.", author: "Platon" },
    { text: "Ein Künstler muss üben, was er liebt, auch allein am Morgen.", author: "Pablo Casals" },
  ],
};

export const LESSON_QUOTES: QuotePool = {
  en: [
    { text: "A good teacher can inspire hope, ignite the imagination, and instill a love of learning.", author: "Brad Henry" },
    { text: "I am indebted to my father for living, but to my teacher for living well.", author: "Alexander the Great" },
    { text: "The teacher who is indeed wise does not bid you to enter the house of his wisdom but leads you to the threshold of your own mind.", author: "Kahlil Gibran" },
    { text: "Teaching is the highest form of understanding.", author: "Aristotle" },
  ],
  it: [
    { text: "Un buon insegnante può ispirare speranza, accendere l'immaginazione e instillare l'amore per l'apprendimento.", author: "Brad Henry" },
    { text: "Sono in debito con mio padre per la vita, ma con il mio insegnante per vivere bene.", author: "Alessandro Magno" },
    { text: "Il maestro davvero saggio non ti invita a entrare nella casa della sua saggezza, ma ti conduce alla soglia della tua stessa mente.", author: "Kahlil Gibran" },
    { text: "L'insegnamento è la forma più alta di comprensione.", author: "Aristotele" },
  ],
  es: [
    { text: "Un buen maestro puede inspirar esperanza, encender la imaginación e inculcar el amor por el aprendizaje.", author: "Brad Henry" },
    { text: "Le debo a mi padre el vivir, pero a mi maestro el vivir bien.", author: "Alejandro Magno" },
    { text: "El maestro verdaderamente sabio no te invita a entrar en la casa de su sabiduría, sino que te lleva al umbral de tu propia mente.", author: "Kahlil Gibran" },
    { text: "Enseñar es la forma más elevada de comprensión.", author: "Aristóteles" },
  ],
  de: [
    { text: "Ein guter Lehrer kann Hoffnung wecken, die Vorstellungskraft entzünden und die Liebe zum Lernen einpflanzen.", author: "Brad Henry" },
    { text: "Meinem Vater verdanke ich das Leben, meinem Lehrer das gute Leben.", author: "Alexander der Große" },
    { text: "Der Lehrer, der wirklich weise ist, lädt dich nicht ein, das Haus seiner Weisheit zu betreten, sondern führt dich zur Schwelle deines eigenen Geistes.", author: "Kahlil Gibran" },
    { text: "Lehren ist die höchste Form des Verstehens.", author: "Aristoteles" },
  ],
};

export const LIBRARY_QUOTES: QuotePool = {
  en: [
    { text: "The notes I handle no better than many pianists. But the pauses — ah, that is where the art resides.", author: "Arthur Schnabel" },
    { text: "A composer is a guy who goes around forcing his will on unsuspecting air.", author: "Aaron Copland" },
    { text: "Music expresses that which cannot be put into words and that which cannot remain silent.", author: "Victor Hugo" },
  ],
  it: [
    { text: "Le note non le maneggio meglio di molti pianisti. Ma le pause — ah, è lì che risiede l'arte.", author: "Arthur Schnabel" },
    { text: "Un compositore è uno che va in giro a imporre la sua volontà all'aria ignara.", author: "Aaron Copland" },
    { text: "La musica esprime ciò che non può essere detto con le parole e ciò che non può rimanere silenzioso.", author: "Victor Hugo" },
  ],
  es: [
    { text: "Las notas no las manejo mejor que muchos pianistas. Pero las pausas — ah, ahí es donde reside el arte.", author: "Arthur Schnabel" },
    { text: "Un compositor es alguien que anda por ahí imponiendo su voluntad al aire desprevenido.", author: "Aaron Copland" },
    { text: "La música expresa lo que no puede decirse con palabras y lo que no puede permanecer en silencio.", author: "Victor Hugo" },
  ],
  de: [
    { text: "Die Noten handhabe ich nicht besser als viele Pianisten. Aber die Pausen — ah, dort wohnt die Kunst.", author: "Arthur Schnabel" },
    { text: "Ein Komponist ist jemand, der umhergeht und seinen Willen ahnungsloser Luft aufzwingt.", author: "Aaron Copland" },
    { text: "Musik drückt das aus, was nicht in Worte gefasst werden kann und was nicht schweigen kann.", author: "Victor Hugo" },
  ],
};

export function pickQuote(pool: QuotePool = PRACTICE_QUOTES, lang: Lang = "en"): Quote {
  const list = pool[lang] || pool.en;
  if (!list || list.length === 0) {
    return { text: "Practice makes perfect.", author: "Anonymous" };
  }
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}
