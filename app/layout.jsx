import "./globals.css";

export const metadata = {
  title: "Paeleap TourMate",
  description: "Your bilingual AI travel companion for exploring China, with thoughtful guidance, cultural discoveries and live city weather.",
  applicationName: "Paeleap TourMate"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
