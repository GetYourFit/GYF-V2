export interface FashionQuote {
  quote: string;
  author: string;
}

export const fashionQuotes: FashionQuote[] = [
  { quote: "Fashion is the armor to survive the reality of everyday life.", author: "Bill Cunningham" },
  { quote: "Style is a way to say who you are without having to speak.", author: "Rachel Zoe" },
  { quote: "Elegance is not about being noticed, it's about being remembered.", author: "Giorgio Armani" },
  { quote: "Clothes mean nothing until someone lives in them.", author: "Marc Jacobs" },
  { quote: "Fashion is about dressing according to what's fashionable. Style is more about being yourself.", author: "Oscar de la Renta" },
  { quote: "The most beautiful thing you can wear is confidence.", author: "Blake Lively" },
  { quote: "In difficult times, fashion is always outrageous.", author: "Elsa Schiaparelli" },
  { quote: "You can have anything you want in life if you dress for it.", author: "Edith Head" },
  { quote: "Fashion is what you buy. Style is what you do with it.", author: "Unknown" },
  { quote: "Dress how you want to be addressed.", author: "Unknown" },
  { quote: "Buy less. Choose well. Make it last.", author: "Vivienne Westwood" },
  { quote: "Fashion is not something that exists in dresses only. Fashion is in the sky, in the street.", author: "Coco Chanel" },
  { quote: "Simplicity is the keynote of all true elegance.", author: "Coco Chanel" },
  { quote: "When in doubt, wear red.", author: "Bill Blass" },
  { quote: "The dress must follow the body of a woman, not the body following the shape of the dress.", author: "Hubert de Givenchy" },
  { quote: "Don't be into trends. Don't make fashion own you, but you decide what you are.", author: "Gianni Versace" },
  { quote: "Fashion is about something that comes from within you.", author: "Ralph Lauren" },
  { quote: "Luxury must be comfortable, otherwise it is not luxury.", author: "Coco Chanel" },
  { quote: "One is never over-dressed or under-dressed with a Little Black Dress.", author: "Karl Lagerfeld" },
  { quote: "Fashion fades, only style remains the same.", author: "Coco Chanel" },
];

/** Returns a random quote, guaranteed not to be the one at `excludeIndex`. */
export function randomQuote(excludeIndex = -1): { quote: FashionQuote; index: number } {
  let idx: number;
  do {
    idx = Math.floor(Math.random() * fashionQuotes.length);
  } while (idx === excludeIndex && fashionQuotes.length > 1);
  return { quote: fashionQuotes[idx]!, index: idx };
}
