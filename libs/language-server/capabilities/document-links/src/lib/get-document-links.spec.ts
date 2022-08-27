import { getDocumentLinks } from './get-document-links';
import { getLanguageModelCache } from '@nx-console/language-server/utils';
import {
  ClientCapabilities,
  getLanguageService,
  TextDocument,
} from 'vscode-json-languageservice';

import { X_COMPLETION_TYPE } from '@nx-console/json-schema';

import * as fs from '@nx-console/file-system';
jest.mock(
  '@nx-console/file-system',
  (): Partial<typeof fs> => ({
    fileExists: jest.fn(() => Promise.resolve(true)),
  })
);

const languageservice = getLanguageService({
  clientCapabilities: ClientCapabilities.LATEST,
});
const documentMapper = getLanguageModelCache(10, 60, (document) =>
  languageservice.parseJSONDocument(document)
);

const { document, jsonAst } = documentMapper.get(
  TextDocument.create(
    'file:///project.json',
    'json',
    0,
    `
{
  "fileCompletion": "project/src/main.ts",
  "dirCompletion": "project/src"
}
    `
  )
);

it('should get all document links for properties that have a X_COMPLETION_TYPE (file type only)', async () => {
  const matchingSchemas = await languageservice.getMatchingSchemas(
    document,
    jsonAst,
    {
      type: 'object',
      properties: {
        fileCompletion: {
          type: 'string',
          [X_COMPLETION_TYPE]: 'file',
        } as any,
        dirCompletion: {
          type: 'string',
          [X_COMPLETION_TYPE]: 'directory',
        } as any,
      },
    }
  );
  const documentLinks = await getDocumentLinks(
    '/workspace',
    jsonAst,
    document,
    matchingSchemas
  );

  expect(documentLinks.map((link) => link.target)).toMatchInlineSnapshot(`
    Array [
      "/workspace/project/src/main.ts",
    ]
  `);
});
