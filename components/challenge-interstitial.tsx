"use client"

import { Button } from "@/components/ui/button"
import { ShieldAlert } from "lucide-react"

interface ChallengeInterstitialProps {
  onProceed: () => void
}

export default function ChallengeInterstitial({ onProceed }: ChallengeInterstitialProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center animate-fade-in">
      <ShieldAlert className="w-16 h-16 text-yellow-500 mb-6" />
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Challenge Pre-framing</h2>
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
        The next step involves translating knowledge into action. This is often the most challenging part of any
        learning journey. Expect moments of difficulty and uncertainty—they are a natural and essential part of the
        growth process.
      </p>
      <p className="text-md text-gray-500 dark:text-gray-500 mb-10">
        Embrace these challenges as opportunities to solidify your understanding. Are you ready to begin?
      </p>
      <Button onClick={onProceed} size="lg">
        I&apos;m Ready, Proceed to Action Plan
      </Button>
    </div>
  )
}
