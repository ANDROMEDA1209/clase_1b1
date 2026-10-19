(function () {
  "use strict";

  const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const SECTORS = ["Centro", "Urdesa", "Alborada", "Sauces", "Kennedy", "Garzota", "Guasmo", "Mapasingue"];
  const PAYMENTS = ["Efectivo", "Tarjeta", "Transferencia", "Billetera digital"];
  const PRODUCTS = [
    { name: "Chocolate", category: "Helados", price: 2.25, base: 9 },
    { name: "Vainilla", category: "Helados", price: 2.00, base: 8 },
    { name: "Mora", category: "Helados", price: 2.25, base: 6 },
    { name: "Maracuyá", category: "Helados", price: 2.35, base: 6 },
    { name: "Coco", category: "Helados", price: 2.40, base: 5 },
    { name: "Cono clásico", category: "Conos", price: 3.00, base: 7 },
    { name: "Presentación familiar", category: "Presentaciones", price: 12.50, base: 2 }
  ];
  const MONTH_FACTORS = [1.08, 0.77, 1.22, 1.12, 0.98, 0.82, 1.27, 1.02, 0.78, 1.03, 1.15, 1.46];
  const SECTOR_FACTORS = {
    Centro: 1.08, Urdesa: 1.15, Alborada: 1.11, Sauces: 0.96,
    Kennedy: 1.05, Garzota: 1.02, Guasmo: 0.88, Mapasingue: 0.91
  };
  const DAYS = [2, 6, 10, 14, 18, 22, 26, 28];
  const sales = [];

  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    DAYS.forEach((day, dayIndex) => {
      PRODUCTS.forEach((product, productIndex) => {
        const sectorIndex = (dayIndex * 3 + productIndex * 2 + monthIndex) % SECTORS.length;
        const sector = SECTORS[sectorIndex];
        const variation = 0.82 + ((monthIndex * 17 + dayIndex * 11 + productIndex * 7) % 29) / 100;
        const weekendLift = [6, 14, 28].includes(day) ? 1.16 : 1;
        const seasonalLift = monthIndex === 11 && productIndex === 6 ? 1.35 : 1;
        const quantity = Math.max(1, Math.round(
          product.base * MONTH_FACTORS[monthIndex] * SECTOR_FACTORS[sector] *
          variation * weekendLift * seasonalLift
        ));
        const date = `2025-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const transactionNumber = `NA-2025-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}-${String(productIndex + 1).padStart(2, "0")}`;
        const paymentIndex = (dayIndex + productIndex + monthIndex) % PAYMENTS.length;

        sales.push({
          date,
          month: MONTHS[monthIndex],
          monthNumber: monthIndex + 1,
          year: 2025,
          product: product.name,
          category: product.category,
          quantity,
          unitPrice: product.price,
          revenue: Number((quantity * product.price).toFixed(2)),
          sector,
          paymentMethod: PAYMENTS[paymentIndex],
          transactionNumber
        });
      });
    });
  }

  window.BIData = Object.freeze({
    months: Object.freeze(MONTHS),
    sectors: Object.freeze(SECTORS),
    payments: Object.freeze(PAYMENTS),
    products: Object.freeze(PRODUCTS.map((product) => Object.freeze({ ...product }))),
    sales: Object.freeze(sales.map((sale) => Object.freeze(sale))),
    simulated: true
  });
})();
