import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

export interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  required?: boolean
}

export const Label = ({ className, required, children, ...props }: LabelProps) => (
  <LabelPrimitive.Root
    className={cn(
      'type-label leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className
    )}
    {...props}
  >
    {children}
    {required && <span className="ml-0.5 text-[hsl(var(--danger))]">*</span>}
  </LabelPrimitive.Root>
)

Label.displayName = 'Label'
