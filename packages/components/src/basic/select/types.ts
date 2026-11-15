import type { AcceptableValue } from 'reka-ui'

/** 级联选择器节点：children 存在即视为父节点，点击/悬停展开下一列 */
export interface CascaderOption {
  label: string
  value: AcceptableValue
  disabled?: boolean
  children?: CascaderOption[]
}
