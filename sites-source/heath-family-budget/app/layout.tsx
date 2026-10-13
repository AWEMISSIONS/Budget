import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"Family Budget",description:"Private family budget, bills and savings tracker.",icons:{icon:"/favicon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
