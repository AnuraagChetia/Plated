import type { Metadata } from "next";
import "./globals.css";


import "./navigation.css";
import "./flow.css";
import "./auth-flow.css";
import "./auth-nav.css";
import "./local-product.css";
import "./dashboard.css";
import "./storefront.css";
import "./owner-dashboard.css";
import "./brand.css";
import Navigation from "./components/Navigation";

export const metadata: Metadata = {
  title: "Plated — Your restaurant, online and on your terms",
  description: "A direct ordering platform made for independent restaurants."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Navigation />{children}</body></html>;
}
