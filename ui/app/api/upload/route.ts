import { NextRequest, NextResponse } from 'next/server';
import FormData from 'form-data';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string || 'token';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const pinataData = new FormData();
    pinataData.append('file', buffer, {
      filename: file.name,
      contentType: file.type,
    });
    pinataData.append('pinataMetadata', JSON.stringify({ name: `${name}_image` }));

    const config = {
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
        ...pinataData.getHeaders(),
      },
    };

    const res = await axios.post<{ IpfsHash: string }>(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      pinataData,
      config
    );

    if (!res.data || !res.data.IpfsHash) {
      throw new Error(`Failed to upload image: ${JSON.stringify(res.data)}`);
    }

    const imageUrl = `${process.env.PINATA_GATEWAY_URL}/ipfs/${res.data.IpfsHash}`;

    return NextResponse.json({ url: imageUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}