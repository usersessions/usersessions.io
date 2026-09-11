'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from "motion/react"
import { Plus } from 'lucide-react'

const faqs = [
  {
    question: "What happens if nothing changes?",
    answer: "People keep hitting the same wall, and no one on your team knows. The recordings pile up. The notes pile up. The page stays the same. Someone eventually notices, weeks later, in a support ticket."
  },
  {
    question: "How is it different with usersessions.io?",
    answer: "You hear about a problem in plain English, the same day it happens. Someone approves the fix once. Next time, it happens on its own. The recordings still exist. They just stop being the only output."
  },
  {
    question: "How exactly does it work?",
    answer: "Usersessions.io runs on your site through one script. It looks for the moments that actually cost you customers: errors, rage clicks, dead clicks, pages that time out. Our AI reads what happened and tells you, in plain words, what went wrong and how sure it is. Then it can act—sending you an update, or fixing the issue automatically and testing it on a slice of visitors first, undoing it automatically if anything looks worse."
  },
  {
    question: "Will it mess with my checkout or login pages?",
    answer: "You decide what it's allowed to do without asking first. Nothing it does touches your checkout, payment, or login pages. A person approves anything that matters. Always."
  }
]

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '720px', margin: '0 auto' }}>
      {faqs.map((faq, idx) => {
        const isOpen = openIndex === idx

        return (
          <motion.div
            key={idx}
            className="glass-panel"
            initial={false}
            animate={{
              borderColor: isOpen ? 'var(--ember)' : 'var(--line)',
              backgroundColor: isOpen ? 'var(--bg-raised)' : 'var(--bg-primary)'
            }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            style={{
              borderRadius: '16px',
              overflow: 'hidden',
              cursor: 'pointer',
              border: '1px solid var(--line)',
            }}
            onClick={() => setOpenIndex(isOpen ? null : idx)}
          >
            <div style={{
              padding: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                color: isOpen ? 'var(--ink)' : 'var(--ink-soft)',
                transition: 'color 0.2s ease',
              }}>
                {faq.question}
              </h3>
              <motion.div
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                style={{
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isOpen ? 'var(--ember)' : 'var(--ink-muted)'
                }}
              >
                <Plus size={24} strokeWidth={2} />
              </motion.div>
            </div>
            
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                >
                  <div style={{
                    padding: '0 24px 24px 24px',
                    color: 'var(--ink-soft)',
                    fontSize: '15px',
                    lineHeight: 1.6,
                    fontFamily: "var(--font-sans)",
                  }}>
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}
