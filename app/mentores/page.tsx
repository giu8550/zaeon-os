"use client";
/** /mentores — a loja com "Mentores" como primeira aba e default (PR-A2, NEXT_PUBLIC_MENTORES_TAB). */
import LojaMentores from "@/components/mentors/LojaMentores";

export default function MentoresPage() {
    return <LojaMentores initialCategory="Mentores" />;
}
