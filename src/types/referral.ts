export type Referral = {
  id: string;
  name: string;
  date: string;
  status: "pendente" | "convertido";
  reward: string;
};