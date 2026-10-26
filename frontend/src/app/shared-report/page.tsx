import {SharedReport} from "@/components/test-result/shared-report";
import type {Metadata} from "next";
export const metadata:Metadata={title:"Laboratory report",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function Page(){return <SharedReport/>;}
