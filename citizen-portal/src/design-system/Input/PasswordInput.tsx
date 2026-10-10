import { forwardRef, useState } from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { Input, type InputProps } from './Input'

export type PasswordInputProps = Omit<InputProps, 'type' | 'iconRight'>

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>((props, ref) => {
  const [show, setShow] = useState(false)
  return (
    <Input
      ref={ref}
      type={show ? 'text' : 'password'}
      iconRight={
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
          className="pointer-events-auto text-foreground-subtle transition-colors hover:text-foreground-default"
        >
          {show ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      }
      {...props}
    />
  )
})

PasswordInput.displayName = 'PasswordInput'
