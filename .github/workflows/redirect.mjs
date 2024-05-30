import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const url = "https://github.com/macuject/web/assets/30207144/7115a93a-f357-4c52-a553-2cd0f94d525f";

const getRedirectedUrl = async (url) => {
  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`
    },
    redirect: 'follow'
  });
  // if (!response.ok) {
  //   console.error('Full response as json:', response);
  //   console.log('Response url:', response.url);
  //   throw new Error(`Failed to get redirected URL: ${response.statusText}`);
  // }
  console.log('Redirected URL:', response.url);
  return response.url;
};

(async () => {
  try {
    const actualImageUrl = await getRedirectedUrl(url);
    console.log('Actual Image URL:', actualImageUrl);
  } catch (error) {
    console.error('Error:', error);
  }
})();
