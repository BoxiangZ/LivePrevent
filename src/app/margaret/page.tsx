import { redirect } from "next/navigation";
import { SUBJECT_ID } from "@/server/data/seed";

export default function MargaretIndex() {
  redirect(`/margaret/${SUBJECT_ID}`);
}
