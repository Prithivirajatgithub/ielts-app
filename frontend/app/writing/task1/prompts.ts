export type ChartType = "line" | "bar";

export interface SeriesDef {
  dataKey: string;
  name: string;
  color: string;
  unit: string;
}

export interface Task1Prompt {
  id: string;
  title: string;
  subtitle: string;
  chartType: ChartType;
  xAxisKey: string;
  data: Array<Record<string, string | number>>;
  series: SeriesDef[];
  question: string;
  chart_data_description: string;
}

export const TASK1_PROMPTS: Task1Prompt[] = [
  {
    id: "coffee-tea-line",
    title: "Coffee vs. Tea Consumption (2010-2020)",
    subtitle:
      "Cups per person per week in the UK, USA and Japan. Hover the chart for exact values.",
    chartType: "line",
    xAxisKey: "year",
    data: [
      { year: "2010", ukCoffee: 4.0, ukTea: 6.2, usCoffee: 3.5, usTea: 1.6, jpCoffee: 1.4, jpTea: 4.8 },
      { year: "2013", ukCoffee: 4.1, ukTea: 6.0, usCoffee: 3.6, usTea: 1.7, jpCoffee: 1.6, jpTea: 4.6 },
      { year: "2016", ukCoffee: 4.3, ukTea: 5.8, usCoffee: 3.7, usTea: 1.8, jpCoffee: 1.8, jpTea: 4.4 },
      { year: "2020", ukCoffee: 4.6, ukTea: 5.6, usCoffee: 3.9, usTea: 1.9, jpCoffee: 2.1, jpTea: 4.1 },
    ],
    series: [
      { dataKey: "ukCoffee", name: "UK - Coffee", color: "#b45309", unit: "cups" },
      { dataKey: "ukTea", name: "UK - Tea", color: "#059669", unit: "cups" },
      { dataKey: "usCoffee", name: "USA - Coffee", color: "#d97706", unit: "cups" },
      { dataKey: "usTea", name: "USA - Tea", color: "#10b981", unit: "cups" },
      { dataKey: "jpCoffee", name: "Japan - Coffee", color: "#92400e", unit: "cups" },
      { dataKey: "jpTea", name: "Japan - Tea", color: "#047857", unit: "cups" },
    ],
    question:
      "The chart below shows coffee and tea consumption (cups per person per week) in three countries - the United Kingdom, the United States and Japan - from 2010 to 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    chart_data_description: `Line chart showing coffee and tea consumption in cups per person per week, 2010-2020:
- UK: coffee rose from 4.0 to 4.6, tea fell from 6.2 to 5.6.
- USA: coffee rose from 3.5 to 3.9, tea rose from 1.6 to 1.9.
- Japan: coffee rose from 1.4 to 2.1, tea fell from 4.8 to 4.1.`,
  },
  {
    id: "renewable-energy-bar",
    title: "Renewable Energy Production (2022)",
    subtitle:
      "Solar, wind and hydro electricity (TWh) in three countries. Hover the chart for exact values.",
    chartType: "bar",
    xAxisKey: "country",
    data: [
      { country: "Germany", solar: 48, wind: 126, hydro: 20 },
      { country: "USA", solar: 142, wind: 320, hydro: 260 },
      { country: "China", solar: 280, wind: 466, hydro: 1300 },
    ],
    series: [
      { dataKey: "solar", name: "Solar", color: "#eab308", unit: "TWh" },
      { dataKey: "wind", name: "Wind", color: "#0ea5e9", unit: "TWh" },
      { dataKey: "hydro", name: "Hydro", color: "#10b981", unit: "TWh" },
    ],
    question:
      "The chart below shows renewable energy production (solar, wind and hydro) in three countries in 2022. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    chart_data_description: `Grouped bar chart of renewable energy production in terawatt-hours (TWh) by source, 2022:
- Germany: solar 48, wind 126, hydro 20.
- USA: solar 142, wind 320, hydro 260.
- China: solar 280, wind 466, hydro 1300.
Hydro dominates in China; wind is the largest source in Germany and the USA; solar is the smallest in every country.`,
  },
  {
    id: "household-expenditure-bar",
    title: "Average Household Expenditure (2010 vs 2020)",
    subtitle:
      "Share of household spending by category (%) in two years. Hover the chart for exact values.",
    chartType: "bar",
    xAxisKey: "category",
    data: [
      { category: "Housing", y2010: 32, y2020: 35 },
      { category: "Food", y2010: 28, y2020: 22 },
      { category: "Transport", y2010: 20, y2020: 21 },
      { category: "Leisure", y2010: 20, y2020: 22 },
    ],
    series: [
      { dataKey: "y2010", name: "2010", color: "#6366f1", unit: "%" },
      { dataKey: "y2020", name: "2020", color: "#f59e0b", unit: "%" },
    ],
    question:
      "The chart below shows the breakdown of average household expenditure (housing, food, transport and leisure) in 2010 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    chart_data_description: `Grouped bar chart of average household expenditure as a percentage of total spending, 2010 vs 2020:
- Housing: rose from 32% to 35%.
- Food: fell from 28% to 22%.
- Transport: rose from 20% to 21%.
- Leisure: rose from 20% to 22%.
Housing was the largest expense in both years and food showed the biggest decline.`,
  },
];
