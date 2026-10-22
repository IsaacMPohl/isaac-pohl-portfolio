export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  size?: string;
  description?: string;
  owners?: { displayName: string; emailAddress: string }[];
}

export interface DriveFetchResult {
  files: GoogleDriveFile[];
  nextPageToken?: string;
  error?: string;
}

/**
 * Fetch files from the user's Google Drive via the Drive REST API v3 using Bearer token.
 */
export async function fetchDriveFiles(
  accessToken: string,
  searchQuery?: string,
  pageSize: number = 25
): Promise<DriveFetchResult> {
  if (!accessToken) {
    return { files: [], error: 'Authentication required to access Google Drive' };
  }

  try {
    const qParts = ["trashed = false"];
    if (searchQuery && searchQuery.trim()) {
      const sanitized = searchQuery.trim().replace(/'/g, "\\'");
      qParts.push(`name contains '${sanitized}'`);
    }

    const q = qParts.join(' and ');
    const fields = 'nextPageToken,files(id,name,mimeType,iconLink,webViewLink,thumbnailLink,modifiedTime,size,description,owners)';
    const url = `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}&fields=${encodeURIComponent(fields)}&q=${encodeURIComponent(q)}&orderBy=modifiedTime desc`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { files: [], error: 'Google session expired. Please sign in again.' };
      }
      if (response.status === 403) {
        return { files: [], error: 'Permission denied. Ensure Google Drive permissions are approved.' };
      }
      const errBody = await response.json().catch(() => ({}));
      const message = errBody?.error?.message || `Google Drive error (${response.status})`;
      return { files: [], error: message };
    }

    const data = await response.json();
    return {
      files: data.files || [],
      nextPageToken: data.nextPageToken
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error while contacting Google Drive';
    return { files: [], error: message };
  }
}

/**
 * Fetch text content of a file (handles Google Docs export to text, or text/markdown files).
 */
export async function fetchFileContent(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<{ content?: string; error?: string }> {
  if (!accessToken) {
    return { error: 'Authentication required' };
  }

  try {
    let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    if (mimeType === 'application/vnd.google-apps.document') {
      // Export Google Doc as plain text
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      }
    });

    if (!response.ok) {
      return { error: `Failed to download file content (${response.status})` };
    }

    const text = await response.text();
    return { content: text };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch document content';
    return { error: message };
  }
}
