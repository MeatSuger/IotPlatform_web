import { inject } from 'vue'
import { FORM_ITEM_INJECTION_KEY } from './injectionKeys'

export function useFormField() {
  const fieldContext = inject(FORM_ITEM_INJECTION_KEY, undefined)
  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormItem>')
  }
  return fieldContext
}
