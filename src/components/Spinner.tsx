interface Props {
  sm?: boolean
}
export default function Spinner({ sm }: Props) {
  return <span className={sm ? 'spinner spinner--sm' : 'spinner'} />
}
