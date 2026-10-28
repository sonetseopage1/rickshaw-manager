<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StoredFile extends Model
{
    protected $table = 'files';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'garage_id', 'kind', 'mime', 'size', 'created_by'];

    /** Folder (inside storage/app/private) holding one garage's uploads. */
    public static function dir(int $garageId): string
    {
        return 'files/' . $garageId;
    }

    public function path(): string
    {
        return self::dir($this->garage_id) . '/' . $this->id;
    }
}
