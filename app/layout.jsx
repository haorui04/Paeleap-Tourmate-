import "./globals.css";

export const metadata = {
  title: "Paeleap TourMate",
  description: "A bilingual, safety-aware AI tour companion for exploring Hangzhou",
  applicationName: "Paeleap TourMate"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#123f3c"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
