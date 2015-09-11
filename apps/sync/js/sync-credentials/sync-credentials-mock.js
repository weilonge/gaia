/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* exported
  SyncCredentials
*/

var SyncCredentials = {
  getCredentials(adapters) {
    return Promise.resolve({
      URL: 'http://localhost:8000/v1/',
      xClientState: '518fef27c6bbc0220aab0f00b1a37308',
      assertion: `eyJhbGciOiJSUzI1NiJ9.eyJwdWJsaWMta2V5Ijp7ImFsZ29yaXRobSI6IkRTIiwieSI6IjE4QTY4RTAzOTc3MjBBOTg5OUE4RjUzRjAxNzE1MDJCNTdDQjE4QTVGODEzM0NEMkVBQzRCQkUzRUZEOTI1OTdDNjc4RDJDMTU1RURCMkU4MENCQjREQjhENzMwOUUzNzA4QTQ3NjFCRTg5Qzg0NjFDOEFGODZEOTUxMjQyMUM3QkQ3RDEwMUIzRURGNDkwRDQ1MUI2MkFFNUJGQzBENzU3MEU0NkE0MDQzNkQ2MDA2NUQyMzM5MUYwOEY3MzQ1RkIxMjc4QTRCRkJFRUVFNDY0MzNBMUY5Mzg2NEQwMTFBQUYyMkY3MDE5RTRGQkIyMjhGNTFDNjlBQjY3OEUzNEQiLCJwIjoiRkY2MDA0ODNEQjZBQkZDNUI0NUVBQjc4NTk0QjM1MzNENTUwRDlGMUJGMkE5OTJBN0E4REFBNkRDMzRGODA0NUFENEU2RTBDNDI5RDMzNEVFRUFBRUZEN0UyM0Q0ODEwQkUwMEU0Q0MxNDkyQ0JBMzI1QkE4MUZGMkQ1QTVCMzA1QThEMTdFQjNCRjRBMDZBMzQ5RDM5MkUwMEQzMjk3NDRBNTE3OTM4MDM0NEU4MkExOEM0NzkzMzQzOEY4OTFFMjJBRUVGODEyRDY5QzhGNzVFMzI2Q0I3MEVBMDAwQzNGNzc2REZEQkQ2MDQ2MzhDMkVGNzE3RkMyNkQwMkUxNyIsInEiOiJFMjFFMDRGOTExRDFFRDc5OTEwMDhFQ0FBQjNCRjc3NTk4NDMwOUMzIiwiZyI6IkM1MkE0QTBGRjNCN0U2MUZERjE4NjdDRTg0MTM4MzY5QTYxNTRGNEFGQTkyOTY2RTNDODI3RTI1Q0ZBNkNGNTA4QjkwRTVERTQxOUUxMzM3RTA3QTJFOUUyQTNDRDVERUE3MDREMTc1RjhFQkY2QUYzOTdENjlFMTEwQjk2QUZCMTdDN0EwMzI1OTMyOUU0ODI5QjBEMDNCQkM3ODk2QjE1QjRBREU1M0UxMzA4NThDQzM0RDk2MjY5QUE4OTA0MUY0MDkxMzZDNzI0MkEzODg5NUM5RDVCQ0NBRDRGMzg5QUYxRDdBNEJEMTM5OEJEMDcyREZGQTg5NjIzMzM5N0EifSwicHJpbmNpcGFsIjp7ImVtYWlsIjoiYWNlYmJiNmMxZDUxNDBhZmIxYzIwMjRiYzdjNjFiMzhAYXBpLmFjY291bnRzLmZpcmVmb3guY29tIn0sImlhdCI6MTQ0MTk3Mjk0MjkxOSwiZXhwIjoxNDQxOTk0NTUyOTE5LCJmeGEtZ2VuZXJhdGlvbiI6MTQzOTIxODI1MTI5OSwiZnhhLWxhc3RBdXRoQXQiOjE0NDE5NzI3NzUsImZ4YS12ZXJpZmllZEVtYWlsIjoibWljaGllbCtlbXB0eXN5bmNAdW5ob3N0ZWQub3JnIiwiaXNzIjoiYXBpLmFjY291bnRzLmZpcmVmb3guY29tIn0.KK5hvrAQWQvMy9hKZ7wMLuSF5JXhb5vYCH6ZEihNNCPt5KsimJGDOZQ9n47UHmM2KqtzAWEfU1Jr6BUnTdb7rPsC8xsHJ6fheNIDuMmoEyt2t6juviH4t_7N1sPkZTn17NQk165gLaPSsx4ur2-_8Lrx17W3XCekUrk0_uUXLhDf7Xi1IU-QYKqSOxyH4-Ook7z5acc4X8qu19peMTdVlQnnyi1zCLyi4v055-03fk3abORoJuPVloRGYqZXMWTakDXpaGCH0KVSF7wvLYj3HW4cgKi4fAzJfq0Wj9vXLJcfC_um-LUdILclh2kUwuw3V0bjYqCnxelAsKY3WNwoGA~eyJhbGciOiJEUzEyOCJ9.eyJleHAiOjIyMzAzNzI5Njg0OTQsImF1ZCI6Imh0dHBzOi8vdG9rZW4uc2VydmljZXMubW96aWxsYS5jb20vIn0=.J5t2a1R5R_LFKPSYtJ3rpOt1AKgsxpPO2rnJUzjluejN5bmUK-aNUQ==`,
      kB: '85c4f8c1d8e3e2186824c127af786891dd03c6e05b1b45f28f7181211bf2affb',
      adapters: adapters
    });
  }
};
