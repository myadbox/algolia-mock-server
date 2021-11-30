#!/usr/bin/env node
import app from './'

const port = 9200

try {
  app().listen(port, (): void => {
    console.log(`Connected successfully on port ${port}`)
  })
} catch (err) {
  console.error(`Error occured: ${err.message}`)
}
