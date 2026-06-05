export const getEmployeeCost = (
  salary: number,
  contractType: string,
  charges: any
) => {
  const chargeSet = charges[contractType] || {};

  let totalCharges = 0;

  Object.values(chargeSet).forEach((percent: any) => {
    totalCharges += salary * (percent / 100);
  });

  const total = salary + totalCharges;
  const percent = salary > 0 ? (totalCharges / salary) * 100 : 0;

  return {
    salary,
    charges: totalCharges,
    total,
    percent,
  };
};