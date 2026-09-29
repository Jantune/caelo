// Odporne kopiowanie tekstu do schowka:
// 1. Natywne API Electrona (najbardziej niezawodne w aplikacji desktopowej)
// 2. Standardowe Web API navigator.clipboard
// 3. Fallback: ukryty <textarea> + document.execCommand('copy')
export async function copyText(text: string): Promise<boolean> {
  if (typeof window !== 'undefined' && window.caelo?.writeClipboard) {
    try {
      const ok = await window.caelo.writeClipboard(text)
      if (ok) return true
    } catch {
      /* przechodzimy do fallbacku poniżej */
    }
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* przechodzimy do fallbacku poniżej */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    // Poza ekranem, ale zaznaczalny (execCommand wymaga selekcji w widocznym DOM).
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.setAttribute('readonly', '')
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
