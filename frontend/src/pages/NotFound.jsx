import Page from '../components/Page'
import Button from '../components/Button'

export default function NotFound() {
  return (
    <Page className="notfound container" title="Not found">
      <p className="script notfound__script">Off the map</p>
      <h1 className="h-xl">This road does not lead anywhere.</h1>
      <Button to="/" variant="ghost">Return home</Button>
    </Page>
  )
}
