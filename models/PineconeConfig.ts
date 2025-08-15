import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IPineconeConfig extends Document {
  tenant_id: number
  api_key: string
  createdAt: Date
  updatedAt: Date
}

const PineconeConfigSchema: Schema<IPineconeConfig> = new Schema(
  {
    tenant_id: { type: Number, required: true, unique: true, index: true },
    api_key: { type: String, required: true },
  },
  { timestamps: true }
)

const PineconeConfig: Model<IPineconeConfig> =
  (mongoose.models.PineconeConfig as Model<IPineconeConfig>) ||
  mongoose.model<IPineconeConfig>('PineconeConfig', PineconeConfigSchema)

export default PineconeConfig
