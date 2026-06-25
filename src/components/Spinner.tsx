interface Props {
  sm?: boolean
  lg?: boolean
}
export default function Spinner({ sm, lg }: Props) {
  const cls = sm ? 'spinner spinner--sm' : lg ? 'spinner spinner--lg' : 'spinner'
  return <span className={cls} />
}
