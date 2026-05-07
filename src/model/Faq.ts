export type Faq = Section[];

type Section = {
  name: string;
  items: Question[];
};

type Question = {
  title: string;
  content: string;
  isOpen?: boolean;
};
